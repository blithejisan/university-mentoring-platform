import { prisma } from "@/lib/prisma";
import { AuthError, requireApprovedMentor } from "@/lib/auth/guards";
import type { AccessTokenPayload } from "@/lib/auth/jwt";
import type { CreateNoticeInput, UpdateNoticeInput } from "@/lib/validation/notice";
import { writeAuditLog } from "@/lib/audit";
import { sendEmail } from "@/lib/email/sender";
import type { NoticeTargetType } from "@prisma/client";

// ─── Scope helpers ───────────────────────────────────────────────────────────

/**
 * Resolves the department ID an actor is scoped to.
 * Returns undefined for ADMIN (no restriction).
 * Throws for roles that don't have a profile.
 */
async function getActorDepartmentId(actor: AccessTokenPayload): Promise<string | undefined> {
  if (actor.role === "ADMIN") return undefined;

  if (actor.role === "MODERATOR") {
    const mod = await prisma.moderatorProfile.findUnique({ where: { userId: actor.sub } });
    if (!mod) throw new AuthError("Moderator profile not found.", 403);
    return mod.departmentId;
  }

  if (actor.role === "MENTOR") {
    const mentor = await prisma.mentorProfile.findUnique({ where: { userId: actor.sub } });
    if (!mentor) throw new AuthError("Mentor profile not found.", 403);
    return mentor.departmentId;
  }

  // Students have a department but can't create notices — callers enforce that
  if (actor.role === "STUDENT") {
    const student = await prisma.studentProfile.findUnique({ where: { userId: actor.sub } });
    if (!student) throw new AuthError("Student profile not found.", 403);
    return student.departmentId;
  }

  throw new AuthError("Unknown role.", 403);
}

/**
 * Validates that the requested targeting is within the actor's authorized scope.
 * - ADMIN: can target ALL / DEPARTMENT / BATCH / STUDENT freely
 * - MODERATOR: can target department they own, or batches/students within it
 * - MENTOR: can target batches they are assigned to, or students in those batches
 */
async function validateNoticeTargeting(
  actor: AccessTokenPayload,
  targetType: NoticeTargetType,
  targetDepartmentId?: string | null,
  targetBatchId?: string | null,
  targetStudentId?: string | null
): Promise<void> {
  if (actor.role === "ADMIN") return; // unrestricted

  if (actor.role === "MODERATOR") {
    const mod = await prisma.moderatorProfile.findUnique({ where: { userId: actor.sub } });
    if (!mod) throw new AuthError("Moderator profile not found.", 403);

    if (targetType === "ALL") {
      throw new AuthError("Moderators cannot create university-wide notices.", 403);
    }
    if (targetType === "DEPARTMENT") {
      if (!targetDepartmentId || targetDepartmentId !== mod.departmentId) {
        throw new AuthError("Moderators can only target their own department.", 403);
      }
    }
    if (targetType === "BATCH") {
      if (!targetBatchId) throw new AuthError("Batch ID required for BATCH target.", 400);
      const batch = await prisma.batch.findUnique({ where: { id: targetBatchId } });
      if (!batch || batch.departmentId !== mod.departmentId) {
        throw new AuthError("Batch is not in your department.", 403);
      }
    }
    if (targetType === "STUDENT") {
      if (!targetStudentId) throw new AuthError("Student ID required for STUDENT target.", 400);
      const student = await prisma.studentProfile.findUnique({ where: { userId: targetStudentId } });
      if (!student || student.departmentId !== mod.departmentId) {
        throw new AuthError("Student is not in your department.", 403);
      }
    }
    return;
  }

  if (actor.role === "MENTOR") {
    await requireApprovedMentor(actor);

    if (targetType === "ALL" || targetType === "DEPARTMENT") {
      throw new AuthError("Mentors can only target batches or individual students.", 403);
    }

    const mentorBatches = await prisma.mentorBatch.findMany({
      where: { mentorId: actor.sub },
      select: { batchId: true },
    });
    const batchIds = new Set(mentorBatches.map((mb) => mb.batchId));

    if (targetType === "BATCH") {
      if (!targetBatchId || !batchIds.has(targetBatchId)) {
        throw new AuthError("You are not assigned to this batch.", 403);
      }
    }
    if (targetType === "STUDENT") {
      if (!targetStudentId) throw new AuthError("Student ID required for STUDENT target.", 400);
      const membership = await prisma.studentBatch.findFirst({
        where: { studentId: targetStudentId, batchId: { in: Array.from(batchIds) }, leftAt: null },
      });
      if (!membership) {
        throw new AuthError("Student is not in any of your assigned batches.", 403);
      }
    }
    return;
  }

  throw new AuthError("Students cannot create notices.", 403);
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function createNotice(actor: AccessTokenPayload, input: CreateNoticeInput) {
  if (actor.role === "STUDENT") {
    throw new AuthError("Students cannot create notices.", 403);
  }

  // Validate targeting scope
  await validateNoticeTargeting(
    actor,
    input.targetType as NoticeTargetType,
    input.targetDepartmentId,
    input.targetBatchId,
    input.targetStudentId
  );

  // Validate date logic
  if (input.publishAt && input.expiryAt && new Date(input.expiryAt) <= new Date(input.publishAt)) {
    throw new AuthError("Expiry date must be after publish date.", 400);
  }

  const notice = await prisma.notice.create({
    data: {
      createdById: actor.sub,
      title: input.title,
      message: input.message,
      targetType: input.targetType as NoticeTargetType,
      targetDepartmentId: input.targetDepartmentId ?? null,
      targetBatchId: input.targetBatchId ?? null,
      targetStudentId: input.targetStudentId ?? null,
      publishAt: input.publishAt ? new Date(input.publishAt) : null,
      expiryAt: input.expiryAt ? new Date(input.expiryAt) : null,
      status: "ACTIVE",
    },
    include: {
      createdBy: { select: { universityIdNumber: true, email: true, role: true } },
      targetBatch: { select: { id: true, name: true } },
      targetDepartment: { select: { id: true, name: true, code: true } },
      targetStudent: { select: { user: { select: { universityIdNumber: true, email: true } } } },
    },
  });

  await writeAuditLog({
    actorId: actor.sub,
    actorRole: actor.role,
    action: "NOTICE_CREATED",
    targetType: "Notice",
    targetId: notice.id,
    newValue: { title: notice.title, targetType: notice.targetType },
  });

  // Best-effort email notification for individual/student notice targets
  if (input.targetType === "STUDENT" && notice.targetStudent?.user?.email) {
    const studentEmail = notice.targetStudent.user.email;
    try {
      const emailResult = await sendEmail({
        to: studentEmail,
        subject: `New Notice: ${notice.title}`,
        html: `<p>A new notice has been posted for you:</p><h3>${notice.title}</h3><p>${notice.message}</p>`,
        text: `A new notice has been posted for you: ${notice.title}\n\n${notice.message}`,
      });
      await prisma.emailLog.create({
        data: {
          recipient: studentEmail,
          relatedNoticeId: notice.id,
          type: "NOTICE",
          status: emailResult.success ? "SENT" : "FAILED",
          error: emailResult.error ?? null,
          sentAt: emailResult.success ? new Date() : null,
        },
      });
    } catch {
      // Best-effort notification should not fail the notice creation
    }
  }

  return notice;
}

export async function listNotices(
  actor: AccessTokenPayload,
  opts: { batchId?: string; departmentId?: string; status?: "ACTIVE" | "ARCHIVED" }
) {
  const now = new Date();

  if (actor.role === "STUDENT") {
    // Students see notices targeted to them: ALL, their DEPARTMENT, their BATCH, or directly them
    const student = await prisma.studentProfile.findUnique({
      where: { userId: actor.sub },
      select: { departmentId: true },
    });
    if (!student) throw new AuthError("Student profile not found.", 404);

    const batchIds = (
      await prisma.studentBatch.findMany({
        where: { studentId: actor.sub, leftAt: null },
        select: { batchId: true },
      })
    ).map((sb) => sb.batchId);

    return prisma.notice.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { publishAt: null },
          { publishAt: { lte: now } },
        ],
        AND: [
          {
            OR: [
              { expiryAt: null },
              { expiryAt: { gt: now } },
            ],
          },
          {
            OR: [
              { targetType: "ALL" },
              { targetType: "DEPARTMENT", targetDepartmentId: student.departmentId },
              { targetType: "BATCH", targetBatchId: { in: batchIds } },
              { targetType: "STUDENT", targetStudentId: actor.sub },
            ],
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { universityIdNumber: true, email: true, role: true } },
        targetBatch: { select: { id: true, name: true } },
        targetDepartment: { select: { id: true, name: true, code: true } },
      },
    });
  }

  if (actor.role === "MENTOR") {
    await requireApprovedMentor(actor);

    const mentorBatches = await prisma.mentorBatch.findMany({
      where: { mentorId: actor.sub },
      select: { batchId: true },
    });
    const batchIds = mentorBatches.map((mb) => mb.batchId);

    // Mentors see their own notices + notices targeting their batches
    const where: Record<string, unknown> = {
      status: opts.status ?? "ACTIVE",
      OR: [
        { createdById: actor.sub },
        { targetType: "BATCH", targetBatchId: { in: batchIds } },
      ],
    };
    if (opts.batchId) {
      (where as { targetBatchId?: string }).targetBatchId = opts.batchId;
      delete (where as { OR?: unknown }).OR;
      where.createdById = actor.sub;
    }

    return prisma.notice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { universityIdNumber: true, email: true, role: true } },
        targetBatch: { select: { id: true, name: true } },
        targetStudent: { select: { user: { select: { universityIdNumber: true, email: true } } } },
      },
    });
  }

  if (actor.role === "MODERATOR") {
    const mod = await prisma.moderatorProfile.findUnique({ where: { userId: actor.sub } });
    if (!mod) throw new AuthError("Moderator profile not found.", 403);

    return prisma.notice.findMany({
      where: {
        status: opts.status ?? "ACTIVE",
        OR: [
          { createdById: actor.sub },
          { targetType: "DEPARTMENT", targetDepartmentId: mod.departmentId },
          {
            targetType: "BATCH",
            targetBatch: { departmentId: mod.departmentId },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { universityIdNumber: true, email: true, role: true } },
        targetBatch: { select: { id: true, name: true } },
        targetDepartment: { select: { id: true, name: true, code: true } },
        targetStudent: { select: { user: { select: { universityIdNumber: true, email: true } } } },
      },
    });
  }

  // ADMIN: full visibility
  return prisma.notice.findMany({
    where: {
      status: opts.status,
      ...(opts.batchId ? { targetBatchId: opts.batchId } : {}),
      ...(opts.departmentId ? { targetDepartmentId: opts.departmentId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { universityIdNumber: true, email: true, role: true } },
      targetBatch: { select: { id: true, name: true } },
      targetDepartment: { select: { id: true, name: true, code: true } },
      targetStudent: { select: { user: { select: { universityIdNumber: true, email: true } } } },
    },
  });
}

export async function getNotice(actor: AccessTokenPayload, noticeId: string) {
  const notice = await prisma.notice.findUnique({
    where: { id: noticeId },
    include: {
      createdBy: { select: { universityIdNumber: true, email: true, role: true } },
      targetBatch: { select: { id: true, name: true } },
      targetDepartment: { select: { id: true, name: true, code: true } },
      targetStudent: { select: { user: { select: { universityIdNumber: true, email: true } } } },
    },
  });

  if (!notice) throw new AuthError("Notice not found.", 404);

  // Re-use listNotices scoping logic by checking if this notice appears in the authorized list
  // For performance we do a direct targeted check
  if (actor.role === "ADMIN") return notice;

  if (actor.role === "STUDENT") {
    const student = await prisma.studentProfile.findUnique({
      where: { userId: actor.sub },
      select: { departmentId: true },
    });
    if (!student) throw new AuthError("Student profile not found.", 403);

    const batchIds = (
      await prisma.studentBatch.findMany({
        where: { studentId: actor.sub, leftAt: null },
        select: { batchId: true },
      })
    ).map((sb) => sb.batchId);

    const canView =
      notice.targetType === "ALL" ||
      (notice.targetType === "DEPARTMENT" && notice.targetDepartmentId === student.departmentId) ||
      (notice.targetType === "BATCH" && notice.targetBatchId && batchIds.includes(notice.targetBatchId)) ||
      (notice.targetType === "STUDENT" && notice.targetStudentId === actor.sub);

    if (!canView) throw new AuthError("Notice not found.", 404);
    return notice;
  }

  if (actor.role === "MODERATOR") {
    const mod = await prisma.moderatorProfile.findUnique({ where: { userId: actor.sub } });
    if (!mod) throw new AuthError("Moderator profile not found.", 403);

    if (notice.createdById === actor.sub) return notice;

    if (notice.targetType === "DEPARTMENT" && notice.targetDepartmentId === mod.departmentId) return notice;

    if (notice.targetType === "BATCH" && notice.targetBatchId) {
      const batch = await prisma.batch.findUnique({ where: { id: notice.targetBatchId } });
      if (batch && batch.departmentId === mod.departmentId) return notice;
    }

    throw new AuthError("Notice not found.", 404);
  }

  if (actor.role === "MENTOR") {
    await requireApprovedMentor(actor);
    if (notice.createdById === actor.sub) return notice;

    if (notice.targetType === "BATCH" && notice.targetBatchId) {
      const assignment = await prisma.mentorBatch.findUnique({
        where: { mentorId_batchId: { mentorId: actor.sub, batchId: notice.targetBatchId } },
      });
      if (assignment) return notice;
    }

    throw new AuthError("Notice not found.", 404);
  }

  throw new AuthError("Not authorized.", 403);
}

export async function updateNotice(actor: AccessTokenPayload, noticeId: string, input: UpdateNoticeInput) {
  const notice = await prisma.notice.findUnique({ where: { id: noticeId } });
  if (!notice) throw new AuthError("Notice not found.", 404);

  // Only creator or admin can update
  if (actor.role !== "ADMIN" && notice.createdById !== actor.sub) {
    throw new AuthError("You can only update your own notices.", 403);
  }

  if (notice.status === "ARCHIVED") {
    throw new AuthError("Cannot update an archived notice.", 400);
  }

  // If targeting is being changed, re-validate scope
  const newTargetType = (input.targetType as NoticeTargetType | undefined) ?? notice.targetType;
  const newDeptId = input.targetDepartmentId !== undefined ? input.targetDepartmentId : notice.targetDepartmentId;
  const newBatchId = input.targetBatchId !== undefined ? input.targetBatchId : notice.targetBatchId;
  const newStudentId = input.targetStudentId !== undefined ? input.targetStudentId : notice.targetStudentId;

  if (input.targetType || input.targetBatchId || input.targetDepartmentId || input.targetStudentId) {
    await validateNoticeTargeting(actor, newTargetType, newDeptId, newBatchId, newStudentId);
  }

  const updated = await prisma.notice.update({
    where: { id: noticeId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.message !== undefined ? { message: input.message } : {}),
      ...(input.targetType !== undefined ? { targetType: input.targetType as NoticeTargetType } : {}),
      ...(input.targetDepartmentId !== undefined ? { targetDepartmentId: input.targetDepartmentId } : {}),
      ...(input.targetBatchId !== undefined ? { targetBatchId: input.targetBatchId } : {}),
      ...(input.targetStudentId !== undefined ? { targetStudentId: input.targetStudentId } : {}),
      ...(input.publishAt !== undefined ? { publishAt: input.publishAt ? new Date(input.publishAt) : null } : {}),
      ...(input.expiryAt !== undefined ? { expiryAt: input.expiryAt ? new Date(input.expiryAt) : null } : {}),
    },
    include: {
      createdBy: { select: { universityIdNumber: true, email: true, role: true } },
      targetBatch: { select: { id: true, name: true } },
      targetDepartment: { select: { id: true, name: true, code: true } },
    },
  });

  await writeAuditLog({
    actorId: actor.sub,
    actorRole: actor.role,
    action: "NOTICE_UPDATED",
    targetType: "Notice",
    targetId: noticeId,
    previousValue: { title: notice.title, status: notice.status },
    newValue: { title: updated.title },
  });

  return updated;
}

export async function archiveNotice(actor: AccessTokenPayload, noticeId: string) {
  const notice = await prisma.notice.findUnique({ where: { id: noticeId } });
  if (!notice) throw new AuthError("Notice not found.", 404);

  // Only creator or admin can archive
  if (actor.role !== "ADMIN" && notice.createdById !== actor.sub) {
    // Moderators can archive notices in their department
    if (actor.role === "MODERATOR") {
      const mod = await prisma.moderatorProfile.findUnique({ where: { userId: actor.sub } });
      if (!mod) throw new AuthError("Moderator profile not found.", 403);

      const isInDept =
        (notice.targetType === "DEPARTMENT" && notice.targetDepartmentId === mod.departmentId) ||
        (notice.targetType === "BATCH" &&
          notice.targetBatchId &&
          (await prisma.batch.findFirst({ where: { id: notice.targetBatchId, departmentId: mod.departmentId } })) !== null);

      if (!isInDept) {
        throw new AuthError("You can only archive notices in your department.", 403);
      }
    } else {
      throw new AuthError("You can only archive your own notices.", 403);
    }
  }

  const archived = await prisma.notice.update({
    where: { id: noticeId },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });

  await writeAuditLog({
    actorId: actor.sub,
    actorRole: actor.role,
    action: "NOTICE_ARCHIVED",
    targetType: "Notice",
    targetId: noticeId,
  });

  return archived;
}

// suppress unused import warning
void getActorDepartmentId;
