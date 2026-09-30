import { prisma } from "@/lib/prisma";
import { AuthError, requireApprovedMentor, requireModeratorOwnsDepartment, requireMentorOwnsBatch } from "@/lib/auth/guards";
import type { AccessTokenPayload } from "@/lib/auth/jwt";
import type { CreateRemarkInput, UpdateRemarkStatusInput } from "@/lib/validation/remark";
import { writeAuditLog } from "@/lib/audit";
import { createUserNotifications, sendTemplatedEmailToUsers } from "@/lib/services/notification";
import { getAppUrl } from "@/lib/app-url";
import type { RemarkStatus } from "@prisma/client";

export async function createRemark(actor: AccessTokenPayload, input: CreateRemarkInput) {
  if (actor.role !== "MENTOR") {
    throw new AuthError("Only mentors can create remarks.", 403);
  }

  await requireApprovedMentor(actor);

  await requireMentorOwnsBatch(actor, input.batchId);

  // Verify student is in this batch (active)
  const membership = await prisma.studentBatch.findFirst({
    where: { studentId: input.studentId, batchId: input.batchId, leftAt: null },
  });
  if (!membership) {
    throw new AuthError("Student is not an active member of this batch.", 400);
  }

  // Verify student exists
  const [student, batch] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { userId: input.studentId }, include: { user: { select: { universityId: true } } } }),
    prisma.batch.findUnique({ where: { id: input.batchId }, include: { department: { select: { universityId: true } } } }),
  ]);
  if (!student) throw new AuthError("Student not found.", 404);
  if (!batch || student.departmentId !== batch.departmentId || student.user.universityId !== batch.department.universityId) {
    throw new AuthError("Student is outside the assigned batch scope.", 403);
  }

  const remark = await prisma.remark.create({
    data: {
      studentId: input.studentId,
      mentorId: actor.sub,
      batchId: input.batchId,
      type: input.type,
      description: input.description,
      status: "OPEN",
    },
    include: {
      student: { include: { user: { select: { id: true, universityId: true, name: true, universityIdNumber: true, email: true } } } },
      mentor: { select: { universityIdNumber: true, email: true } },
      batch: { select: { id: true, name: true } },
    },
  });

  await writeAuditLog({
    actorId: actor.sub,
    actorRole: actor.role,
    action: "REMARK_CREATED",
    targetType: "Remark",
    targetId: remark.id,
    newValue: { studentId: input.studentId, type: input.type },
  });

  await createUserNotifications([remark.studentId], {
    type: "REMARK",
    title: `New mentor remark: ${remark.type}`,
    message: remark.description,
    href: "/",
    sourceKey: `remark:${remark.id}:created`,
  }, "inAppRemarks");
  if (remark.student?.user?.email) {
    await sendTemplatedEmailToUsers([{
      id: remark.studentId,
      email: remark.student.user.email,
      name: remark.student.user.name,
      role: "STUDENT",
      universityId: remark.student.user.universityId,
    }], {
      key: "REMARK",
      type: "REMARK",
      preference: "emailRemarks",
      dedupeKey: (userId) => `remark:${remark.id}:created:${userId}`,
      variables: () => ({ remarkType: remark.type, message: remark.description, url: getAppUrl("/student/dashboard") }),
    });
  }

  return remark;
}

export async function listRemarks(
  actor: AccessTokenPayload,
  opts: { studentId?: string; batchId?: string; status?: RemarkStatus }
) {
  if (actor.role === "STUDENT") {
    // Students can only see their own remarks
    return prisma.remark.findMany({
      where: {
        studentId: actor.sub,
        ...(opts.status ? { status: opts.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        mentor: { select: { universityIdNumber: true, email: true } },
        batch: { select: { id: true, name: true } },
        resolvedBy: { select: { universityIdNumber: true, email: true, role: true } },
      },
    });
  }

  if (actor.role === "MENTOR") {
    await requireApprovedMentor(actor);
    const [mentor, user] = await Promise.all([
      prisma.mentorProfile.findUnique({ where: { userId: actor.sub }, select: { departmentId: true, department: { select: { universityId: true } } } }),
      prisma.user.findUnique({ where: { id: actor.sub }, select: { universityId: true } }),
    ]);
    if (!mentor || !user || mentor.department.universityId !== user.universityId) throw new AuthError("Mentor profile is outside your university.", 403);

    // Mentor can see remarks they authored, scoped to their batches
    const mentorBatches = await prisma.mentorBatch.findMany({
      where: { mentorId: actor.sub, batch: { departmentId: mentor.departmentId, department: { universityId: user.universityId } } },
      select: { batchId: true },
    });
    const batchIds = mentorBatches.map((mb) => mb.batchId);

    return prisma.remark.findMany({
      where: {
        mentorId: actor.sub,
        batchId: { in: batchIds },
        ...(opts.studentId ? { studentId: opts.studentId } : {}),
        ...(opts.batchId ? { batchId: opts.batchId } : {}),
        ...(opts.status ? { status: opts.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        student: { include: { user: { select: { universityIdNumber: true, email: true } } } },
        batch: { select: { id: true, name: true } },
        resolvedBy: { select: { universityIdNumber: true, email: true, role: true } },
      },
    });
  }

  if (actor.role === "MODERATOR") {
    const mod = await prisma.moderatorProfile.findUnique({ where: { userId: actor.sub } });
    if (!mod) throw new AuthError("Moderator profile not found.", 403);
    await requireModeratorOwnsDepartment(actor, mod.departmentId);

    return prisma.remark.findMany({
      where: {
        batch: { departmentId: mod.departmentId },
        ...(opts.studentId ? { studentId: opts.studentId } : {}),
        ...(opts.batchId ? { batchId: opts.batchId } : {}),
        ...(opts.status ? { status: opts.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        student: { include: { user: { select: { universityIdNumber: true, email: true } } } },
        mentor: { select: { universityIdNumber: true, email: true } },
        batch: { select: { id: true, name: true } },
        resolvedBy: { select: { universityIdNumber: true, email: true, role: true } },
      },
    });
  }

  const admin = await prisma.user.findUnique({ where: { id: actor.sub }, select: { universityId: true } });
  if (!admin) throw new AuthError("Admin account not found.", 404);
  return prisma.remark.findMany({
    where: {
      batch: { department: { universityId: admin.universityId } },
      ...(opts.studentId ? { studentId: opts.studentId } : {}),
      ...(opts.batchId ? { batchId: opts.batchId } : {}),
      ...(opts.status ? { status: opts.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      student: { include: { user: { select: { id: true, universityId: true, name: true, universityIdNumber: true, email: true } } } },
      mentor: { select: { universityIdNumber: true, email: true } },
      batch: { select: { id: true, name: true } },
      resolvedBy: { select: { universityIdNumber: true, email: true, role: true } },
    },
  });
}

export async function getRemark(actor: AccessTokenPayload, remarkId: string) {
  const remark = await prisma.remark.findUnique({
    where: { id: remarkId },
    include: {
      student: { include: { user: { select: { universityIdNumber: true, email: true } }, department: true } },
      mentor: { select: { universityIdNumber: true, email: true } },
      batch: { select: { id: true, name: true, departmentId: true } },
      resolvedBy: { select: { universityIdNumber: true, email: true, role: true } },
    },
  });

  if (!remark) throw new AuthError("Remark not found.", 404);

  if (actor.role === "ADMIN") {
    await requireModeratorOwnsDepartment(actor, remark.batch.departmentId);
    return remark;
  }

  if (actor.role === "STUDENT") {
    if (remark.studentId !== actor.sub) throw new AuthError("Remark not found.", 404);
    return remark;
  }

  if (actor.role === "MENTOR") {
    await requireApprovedMentor(actor);
    await requireMentorOwnsBatch(actor, remark.batch.id);
    if (remark.mentorId !== actor.sub) throw new AuthError("Remark not found.", 404);
    return remark;
  }

  if (actor.role === "MODERATOR") {
    const mod = await prisma.moderatorProfile.findUnique({ where: { userId: actor.sub } });
    if (!mod) throw new AuthError("Moderator profile not found.", 403);
    await requireModeratorOwnsDepartment(actor, mod.departmentId);
    if (remark.batch.departmentId !== mod.departmentId) throw new AuthError("Remark not found.", 404);
    return remark;
  }

  throw new AuthError("Not authorized.", 403);
}

export async function updateRemarkStatus(
  actor: AccessTokenPayload,
  remarkId: string,
  input: UpdateRemarkStatusInput
) {
  const remark = await prisma.remark.findUnique({
    where: { id: remarkId },
    include: { batch: { select: { departmentId: true, department: { select: { universityId: true } } } } },
  });

  if (!remark) throw new AuthError("Remark not found.", 404);

  // Students can never modify remark status
  if (actor.role === "STUDENT") {
    throw new AuthError("Students cannot modify remark status.", 403);
  }

  // Mentors can only update their own remarks
  if (actor.role === "MENTOR") {
    await requireApprovedMentor(actor);
    await requireMentorOwnsBatch(actor, remark.batchId);
    if (remark.mentorId !== actor.sub) {
      throw new AuthError("You can only update your own remarks.", 403);
    }
  }

  // Moderators must own the department
  if (actor.role === "MODERATOR" || actor.role === "ADMIN") {
    await requireModeratorOwnsDepartment(actor, remark.batch.departmentId);
  }

  const previousStatus = remark.status;

  const updated = await prisma.remark.update({
    where: { id: remarkId },
    data: {
      status: input.status as RemarkStatus,
      resolutionNote: input.resolutionNote !== undefined ? input.resolutionNote : remark.resolutionNote,
      ...(input.status === "RESOLVED"
        ? { resolvedAt: new Date(), resolvedById: actor.sub }
        : {}),
    },
    include: {
      student: { include: { user: { select: { id: true, universityId: true, name: true, universityIdNumber: true, email: true } } } },
      mentor: { select: { universityIdNumber: true, email: true } },
      batch: { select: { id: true, name: true } },
      resolvedBy: { select: { universityIdNumber: true, email: true, role: true } },
    },
  });

  await writeAuditLog({
    actorId: actor.sub,
    actorRole: actor.role,
    action: "REMARK_STATUS_UPDATED",
    targetType: "Remark",
    targetId: remarkId,
    previousValue: { status: previousStatus },
    newValue: { status: input.status },
  });

  await createUserNotifications([updated.studentId], {
    type: "REMARK",
    title: `Remark updated: ${updated.type}`,
    message: `Status: ${updated.status}${updated.resolutionNote ? `. ${updated.resolutionNote}` : ""}`,
    href: "/",
    sourceKey: `remark:${updated.id}:status:${updated.status}:${updated.updatedAt.getTime()}`,
  }, "inAppRemarks");
  if (updated.student?.user?.email) {
    await sendTemplatedEmailToUsers([{
      id: updated.studentId,
      email: updated.student.user.email,
      name: updated.student.user.name,
      role: "STUDENT",
      universityId: updated.student.user.universityId,
    }], {
      key: "REMARK",
      type: "REMARK",
      preference: "emailRemarks",
      dedupeKey: (userId) => `remark:${updated.id}:status:${updated.updatedAt.getTime()}:${userId}`,
      variables: () => ({
        remarkType: updated.type,
        message: `Your remark status is ${updated.status}.${updated.resolutionNote ? ` Resolution: ${updated.resolutionNote}` : ""}`,
        url: getAppUrl("/student/dashboard"),
      }),
    });
  }

  return updated;
}
