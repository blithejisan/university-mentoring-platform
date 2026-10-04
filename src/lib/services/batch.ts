import { prisma } from "@/lib/prisma";
import { AuthError, requireModeratorOwnsDepartment, requireMentorOwnsBatch, requireApprovedMentor } from "@/lib/auth/guards";
import type { AccessTokenPayload } from "@/lib/auth/jwt";
import type { AddStudentByIdInput, CreateBatchInput, CreateMentorBatchInput, ImportStudentRowInput, UpdateBatchInput } from "@/lib/validation/batch";
import { writeAuditLog } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { randomBytes } from "node:crypto";
import { compareStudentIds } from "@/lib/student-sorting";

export async function createBatch(actor: AccessTokenPayload, input: CreateBatchInput) {
  if (actor.role !== "ADMIN" && actor.role !== "MODERATOR") {
    throw new AuthError("Not authorized to create batches.", 403);
  }

  await requireModeratorOwnsDepartment(actor, input.departmentId);

  return createBatchRecord(actor, input.departmentId, input);
}

export async function createMentorBatch(actor: AccessTokenPayload, input: CreateMentorBatchInput) {
  await requireApprovedMentor(actor);
  const mentor = await prisma.mentorProfile.findUnique({ where: { userId: actor.sub } });
  if (!mentor) throw new AuthError("Mentor profile not found.", 403);

  return createBatchRecord(actor, mentor.departmentId, input, actor.sub);
}

async function createBatchRecord(
  actor: AccessTokenPayload,
  departmentId: string,
  input: Omit<CreateBatchInput, "departmentId">,
  mentorId?: string
) {
  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.batch.create({
      data: {
        departmentId,
        name: input.name,
        description: input.description,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        status: "ACTIVE",
      },
      include: { department: true },
    });

    if (mentorId) {
      await tx.mentorBatch.create({ data: { mentorId, batchId: created.id } });
    }

    return created;
  });

  await writeAuditLog({
    actorId: actor.sub,
    actorRole: actor.role,
    action: "BATCH_CREATED",
    targetType: "Batch",
    targetId: batch.id,
    newValue: { name: batch.name, departmentId },
  });

  return batch;
}

export async function updateBatch(actor: AccessTokenPayload, batchId: string, input: UpdateBatchInput) {
  const existing = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!existing) throw new AuthError("Batch not found.", 404);

  await requireBatchManager(actor, batchId, existing.departmentId);

  const updated = await prisma.batch.update({
    where: { id: batchId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate ? new Date(input.startDate) : null } : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate ? new Date(input.endDate) : null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    include: { department: true },
  });

  await writeAuditLog({
    actorId: actor.sub,
    actorRole: actor.role,
    action: "BATCH_UPDATED",
    targetType: "Batch",
    targetId: batchId,
    previousValue: { name: existing.name, status: existing.status },
    newValue: { name: updated.name, status: updated.status },
  });

  return updated;
}

export async function archiveBatch(actor: AccessTokenPayload, batchId: string) {
  const existing = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!existing) throw new AuthError("Batch not found.", 404);

  await requireBatchManager(actor, batchId, existing.departmentId);

  const archived = await prisma.batch.update({
    where: { id: batchId },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });

  await writeAuditLog({
    actorId: actor.sub,
    actorRole: actor.role,
    action: "BATCH_ARCHIVED",
    targetType: "Batch",
    targetId: batchId,
  });

  return archived;
}

async function requireBatchManager(actor: AccessTokenPayload, batchId: string, departmentId: string) {
  if (actor.role === "MENTOR") {
    await requireMentorOwnsBatch(actor, batchId);
    const mentor = await prisma.mentorProfile.findUnique({
      where: { userId: actor.sub },
      select: { departmentId: true },
    });
    if (!mentor || mentor.departmentId !== departmentId) {
      throw new AuthError("Not authorized to manage batches outside your department.", 403);
    }
    return;
  }

  await requireModeratorOwnsDepartment(actor, departmentId);
}

function listDepartmentBatches(departmentId?: string, mentorId?: string, batchIds?: string[]) {
  return prisma.batch.findMany({
    ...(departmentId || mentorId || batchIds
      ? { where: { ...(departmentId ? { departmentId } : {}), ...(mentorId ? { mentorBatches: { some: { mentorId } } } : {}), ...(batchIds ? { id: { in: batchIds } } : {}) } }
      : {}),
    orderBy: { createdAt: "desc" },
    include: {
      department: true,
      mentorBatches: {
        where: { mentor: { approvalStatus: "APPROVED" } },
        select: { mentor: { select: { user: { select: { name: true, universityIdNumber: true } } } } },
      },
      _count: { select: { studentBatches: true, mentorBatches: true } },
    },
  });
}

export async function listBatches(actor: AccessTokenPayload) {
  if (actor.role === "ADMIN") {
    const admin = await prisma.user.findUnique({ where: { id: actor.sub }, select: { universityId: true } });
    if (!admin) throw new AuthError("Admin account not found.", 404);
    return prisma.batch.findMany({
      where: { department: { universityId: admin.universityId } },
      orderBy: { createdAt: "desc" },
      include: {
        department: true,
        mentorBatches: { where: { mentor: { approvalStatus: "APPROVED" } }, select: { mentor: { select: { user: { select: { name: true, universityIdNumber: true } } } } } },
        _count: { select: { studentBatches: true, mentorBatches: true } },
      },
    });
  }

  if (actor.role === "MODERATOR") {
    const moderator = await prisma.moderatorProfile.findUnique({ where: { userId: actor.sub } });
    if (!moderator) throw new AuthError("Moderator profile not found.", 403);

    await requireModeratorOwnsDepartment(actor, moderator.departmentId);
    return listDepartmentBatches(moderator.departmentId);
  }

  if (actor.role === "MENTOR") {
    await requireApprovedMentor(actor);
    const [mentor, mentorUser] = await Promise.all([
      prisma.mentorProfile.findUnique({ where: { userId: actor.sub }, include: { department: { select: { universityId: true } } } }),
      prisma.user.findUnique({ where: { id: actor.sub }, select: { universityId: true } }),
    ]);
    if (!mentor) throw new AuthError("Mentor profile not found.", 403);
    if (!mentorUser || mentor.department.universityId !== mentorUser.universityId) throw new AuthError("Mentor profile is outside your university.", 403);
    return listDepartmentBatches(mentor.departmentId, actor.sub);
  }

  if (actor.role === "STUDENT") {
    const student = await prisma.studentProfile.findUnique({
      where: { userId: actor.sub },
      select: { departmentId: true, department: { select: { universityId: true } }, user: { select: { universityId: true, status: true } } },
    });
    if (!student) throw new AuthError("Student profile not found.", 403);
    if (student.user.status !== "ACTIVE" || student.department.universityId !== student.user.universityId) {
      throw new AuthError("Student profile is outside your university.", 403);
    }
    const memberships = await prisma.studentBatch.findMany({
      where: { studentId: actor.sub, leftAt: null, batch: { departmentId: student.departmentId, department: { universityId: student.user.universityId } } },
      select: { batchId: true },
    });
    return listDepartmentBatches(student.departmentId, undefined, memberships.map(({ batchId }) => batchId));
  }

  throw new AuthError("Unauthorized role.", 403);
}

export async function getBatchDetails(actor: AccessTokenPayload, batchId: string) {
  await requireMentorOwnsBatch(actor, batchId);

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: {
      department: true,
      studentBatches: {
        include: {
          student: {
            select: {
              userId: true,
              phone: true,
              user: {
                select: {
                  id: true,
                  universityIdNumber: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: [
          { student: { user: { universityIdNumber: "asc" } } },
          { joinedAt: "asc" },
        ],
      },
      mentorBatches: {
        include: {
          mentor: {
            select: {
              userId: true,
              approvalStatus: true,
              user: {
                select: {
                  id: true,
                  universityIdNumber: true,
                  name: true,
                  email: true,
                  status: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!batch) throw new AuthError("Batch not found.", 404);
  batch.studentBatches.sort((a, b) =>
    compareStudentIds(a.student.user.universityIdNumber, b.student.user.universityIdNumber)
  );
  return batch;
}

export async function assignStudentToBatch(actor: AccessTokenPayload, batchId: string, studentUserId: string) {
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) throw new AuthError("Batch not found.", 404);

  await requireBatchManager(actor, batchId, batch.departmentId);

  const student = await prisma.studentProfile.findUnique({
    where: { userId: studentUserId },
    include: { user: true },
  });
  if (!student) throw new AuthError("Student profile not found.", 404);

  if (student.departmentId !== batch.departmentId) {
    throw new AuthError("Student does not belong to the batch's department.", 400);
  }

  const existingAssignment = await prisma.studentBatch.findUnique({
    where: { studentId_batchId: { studentId: studentUserId, batchId } },
  });

  if (existingAssignment) {
    if (existingAssignment.leftAt) {
      // Re-join
      const updated = await prisma.studentBatch.update({
        where: { studentId_batchId: { studentId: studentUserId, batchId } },
        data: { leftAt: null, joinedAt: new Date() },
      });
      return updated;
    }
    throw new AuthError("Student is already assigned to this batch.", 409);
  }

  const assignment = await prisma.studentBatch.create({
    data: {
      studentId: studentUserId,
      batchId,
    },
  });

  await writeAuditLog({
    actorId: actor.sub,
    actorRole: actor.role,
    action: "STUDENT_ASSIGNED_TO_BATCH",
    targetType: "StudentBatch",
    targetId: `${studentUserId}_${batchId}`,
    newValue: { studentUserId, batchId },
  });

  return assignment;
}

export async function addStudentById(actor: AccessTokenPayload, batchId: string, input: AddStudentByIdInput) {
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) throw new AuthError("Batch not found.", 404);
  await requireBatchManager(actor, batchId, batch.departmentId);

  const universityIdNumber = input.universityIdNumber.trim();
  const existingUser = await prisma.user.findUnique({
    where: { universityIdNumber },
    include: { studentProfile: true },
  });

  let studentUserId: string;
  let linkedExistingStudent = false;
  if (existingUser) {
    if (existingUser.role !== "STUDENT" || !existingUser.studentProfile || existingUser.studentProfile.departmentId !== batch.departmentId) {
      throw new AuthError("Student ID is not available in this department.", 404);
    }
    studentUserId = existingUser.id;
    linkedExistingStudent = true;
  } else {
    if (!input.name?.trim() || !input.email?.trim()) {
      throw new AuthError("Name and email are required for a new student ID.", 400);
    }

    const existingEmail = await prisma.user.findUnique({ where: { email: input.email.toLowerCase().trim() } });
    if (existingEmail) throw new AuthError("This email address is already registered to another account.", 409);

    const department = await prisma.department.findUnique({
      where: { id: batch.departmentId },
      select: { universityId: true },
    });
    if (!department) throw new AuthError("Batch department not found.", 404);

    const passwordHash = await hashPassword(randomBytes(48).toString("base64url"));
    const newStudent = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          universityId: department.universityId,
          role: "STUDENT",
          universityIdNumber,
          name: input.name!.trim(),
          email: input.email!.trim().toLowerCase(),
          passwordHash,
          status: "PENDING_VERIFICATION",
        },
      });
      await tx.studentProfile.create({
        data: {
          userId: user.id,
          departmentId: batch.departmentId,
          phone: input.phone?.trim() || null,
        },
      });
      return user;
    });
    studentUserId = newStudent.id;
  }

  const existingAssignment = await prisma.studentBatch.findUnique({
    where: { studentId_batchId: { studentId: studentUserId, batchId } },
  });
  if (existingAssignment && !existingAssignment.leftAt) {
    throw new AuthError("Student is already assigned to this batch.", 409);
  }

  const assignment = existingAssignment
    ? await prisma.studentBatch.update({
        where: { studentId_batchId: { studentId: studentUserId, batchId } },
        data: { leftAt: null, joinedAt: new Date() },
      })
    : await prisma.studentBatch.create({ data: { studentId: studentUserId, batchId } });

  await writeAuditLog({
    actorId: actor.sub,
    actorRole: actor.role,
    action: "STUDENT_ASSIGNED_TO_BATCH",
    targetType: "StudentBatch",
    targetId: `${studentUserId}_${batchId}`,
    newValue: { studentUserId, batchId, linkedExistingStudent },
  });

  return { assignment, studentUserId, linkedExistingStudent };
}

export async function importStudentsFromSpreadsheet(actor: AccessTokenPayload, batchId: string, rows: ImportStudentRowInput[]) {
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) throw new AuthError("Batch not found.", 404);
  await requireBatchManager(actor, batchId, batch.departmentId);

  const imported: Array<{ studentId: string; name: string; email: string; phone: string }> = [];
  const skipped: Array<{ studentId: string; reason: string }> = [];
  const failed: Array<{ studentId: string; reason: string }> = [];

  const seenStudentIds = new Set<string>();

  const sortedRows = [...rows].sort((a, b) =>
    compareStudentIds(a.universityIdNumber.trim(), b.universityIdNumber.trim())
  );

  for (const row of sortedRows) {
    const studentId = row.universityIdNumber.trim();

    if (seenStudentIds.has(studentId)) {
      skipped.push({ studentId, reason: "Duplicate Student ID in file." });
      continue;
    }
    seenStudentIds.add(studentId);

    try {
      await addStudentById(actor, batchId, {
        universityIdNumber: studentId,
        name: row.name,
        email: row.email,
        phone: row.phone,
      });
      imported.push({
        studentId,
        name: row.name,
        email: row.email,
        phone: row.phone,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed.";
      if (error instanceof Error && "status" in error && typeof (error as { status?: number }).status === "number" && (error as { status: number }).status === 409) {
        skipped.push({ studentId, reason: message });
      } else {
        failed.push({ studentId, reason: message });
      }
    }
  }

  return { imported, skipped, failed };
}

export async function removeStudentFromBatch(actor: AccessTokenPayload, batchId: string, studentUserId: string) {
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) throw new AuthError("Batch not found.", 404);

  await requireBatchManager(actor, batchId, batch.departmentId);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "batches" WHERE "id" = ${batchId} FOR UPDATE`;
    const membership = await tx.studentBatch.update({
      where: { studentId_batchId: { studentId: studentUserId, batchId } },
      data: { leftAt: new Date() },
    });
    await tx.user.updateMany({
      where: {
        id: studentUserId,
        crBatchId: batchId,
        isCR: true,
        crStatus: "APPROVED",
      },
      data: {
        isCR: false,
        crStatus: "NONE",
        crApprovedAt: null,
        crBatchId: null,
      },
    });
    return membership;
  });

  await writeAuditLog({
    actorId: actor.sub,
    actorRole: actor.role,
    action: "STUDENT_REMOVED_FROM_BATCH",
    targetType: "StudentBatch",
    targetId: `${studentUserId}_${batchId}`,
  });

  return updated;
}

export async function assignMentorToBatch(actor: AccessTokenPayload, batchId: string, mentorUserId: string) {
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) throw new AuthError("Batch not found.", 404);

  await requireModeratorOwnsDepartment(actor, batch.departmentId);

  const mentor = await prisma.mentorProfile.findUnique({
    where: { userId: mentorUserId },
  });
  if (!mentor || mentor.approvalStatus !== "APPROVED") {
    throw new AuthError("Mentor is not approved or profile not found.", 400);
  }

  if (mentor.departmentId !== batch.departmentId) {
    throw new AuthError("Mentor does not belong to the batch's department.", 400);
  }

  const existing = await prisma.mentorBatch.findUnique({
    where: { mentorId_batchId: { mentorId: mentorUserId, batchId } },
  });
  if (existing) {
    throw new AuthError("Mentor is already assigned to this batch.", 409);
  }

  const assignment = await prisma.mentorBatch.create({
    data: {
      mentorId: mentorUserId,
      batchId,
    },
  });

  await writeAuditLog({
    actorId: actor.sub,
    actorRole: actor.role,
    action: "MENTOR_ASSIGNED_TO_BATCH",
    targetType: "MentorBatch",
    targetId: `${mentorUserId}_${batchId}`,
    newValue: { mentorUserId, batchId },
  });

  return assignment;
}

export async function removeMentorFromBatch(actor: AccessTokenPayload, batchId: string, mentorUserId: string) {
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) throw new AuthError("Batch not found.", 404);

  await requireModeratorOwnsDepartment(actor, batch.departmentId);

  const deleted = await prisma.mentorBatch.delete({
    where: { mentorId_batchId: { mentorId: mentorUserId, batchId } },
  });

  await writeAuditLog({
    actorId: actor.sub,
    actorRole: actor.role,
    action: "MENTOR_REMOVED_FROM_BATCH",
    targetType: "MentorBatch",
    targetId: `${mentorUserId}_${batchId}`,
  });

  return deleted;
}

export async function searchStudents(
  actor: AccessTokenPayload,
  query: string,
  options: { includeNonActive?: boolean } = {}
) {
  if (actor.role !== "ADMIN" && actor.role !== "MODERATOR" && actor.role !== "MENTOR") {
    throw new AuthError("Not authorized to search students.", 403);
  }

  let departmentIdFilter: string | undefined;
  let universityIdFilter: string | undefined;
  let allowedStudentUserIds: string[] | undefined;

  if (actor.role === "ADMIN") {
    const admin = await prisma.user.findUnique({ where: { id: actor.sub }, select: { universityId: true } });
    if (!admin) throw new AuthError("Admin account not found.", 404);
    universityIdFilter = admin.universityId;
  } else if (actor.role === "MODERATOR") {
    const moderator = await prisma.moderatorProfile.findUnique({ where: { userId: actor.sub } });
    if (!moderator) throw new AuthError("Moderator profile not found.", 403);
    departmentIdFilter = moderator.departmentId;
    const owner = await prisma.user.findUnique({ where: { id: actor.sub }, select: { universityId: true } });
    const department = await prisma.department.findUnique({ where: { id: moderator.departmentId }, select: { universityId: true } });
    if (!owner || !department || owner.universityId !== department.universityId) throw new AuthError("Moderator department is outside your university.", 403);
  } else if (actor.role === "MENTOR") {
    await requireApprovedMentor(actor);
    const mentorBatches = await prisma.mentorBatch.findMany({
      where: { mentorId: actor.sub },
      select: { batchId: true, batch: { select: { departmentId: true, department: { select: { universityId: true } } } } },
    });
    const batchIds = mentorBatches.map((mb) => mb.batchId);
    const [mentor, mentorUser] = await Promise.all([
      prisma.mentorProfile.findUnique({ where: { userId: actor.sub }, select: { departmentId: true, department: { select: { universityId: true } } } }),
      prisma.user.findUnique({ where: { id: actor.sub }, select: { universityId: true } }),
    ]);
    if (!mentor) throw new AuthError("Mentor profile not found.", 403);
    if (!mentorUser || mentor.department.universityId !== mentorUser.universityId || mentorBatches.some((mb) => mb.batch.departmentId !== mentor.departmentId || mb.batch.department.universityId !== mentorUser.universityId)) {
      throw new AuthError("Assigned batch falls outside your department.", 403);
    }
    departmentIdFilter = mentor.departmentId;
    universityIdFilter = mentorUser.universityId;
    const studentBatches = await prisma.studentBatch.findMany({
      where: { batchId: { in: batchIds }, leftAt: null },
      select: { studentId: true },
    });
    allowedStudentUserIds = Array.from(new Set(studentBatches.map((sb) => sb.studentId)));
  }

  const students = await prisma.studentProfile.findMany({
    where: {
      ...(departmentIdFilter ? { departmentId: departmentIdFilter } : {}),
      ...(allowedStudentUserIds ? { userId: { in: allowedStudentUserIds } } : {}),
      user: {
        ...(universityIdFilter ? { universityId: universityIdFilter } : {}),
        role: "STUDENT",
        ...(!options.includeNonActive ? { status: "ACTIVE" } : {}),
        OR: [
          { universityIdNumber: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
    },
    select: {
      userId: true,
      departmentId: true,
      phone: true,
      user: {
        select: {
          id: true,
          universityIdNumber: true,
          name: true,
          email: true,
        },
      },
      studentBatches: {
        where: { leftAt: null },
        select: { batch: { select: { id: true, name: true } } },
      },
    },
    orderBy: { user: { universityIdNumber: "asc" } },
  });

  return students
    .sort((a, b) => compareStudentIds(a.user.universityIdNumber, b.user.universityIdNumber))
    .slice(0, 50);
}
