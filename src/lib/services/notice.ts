import { prisma } from "@/lib/prisma";
import { AuthError, requireApprovedMentor, requireModeratorOwnsDepartment } from "@/lib/auth/guards";
import type { AccessTokenPayload } from "@/lib/auth/jwt";
import type { CreateNoticeInput, UpdateNoticeInput } from "@/lib/validation/notice";
import { writeAuditLog } from "@/lib/audit";
import { createUserNotifications, sendTemplatedEmailToUsers } from "@/lib/services/notification";
import type { NoticeTargetType, Prisma } from "@prisma/client";

// ─── Scope helpers ───────────────────────────────────────────────────────────

async function getActorUniversityId(actor: AccessTokenPayload) {
  const user = await prisma.user.findUnique({ where: { id: actor.sub }, select: { universityId: true } });
  if (!user) throw new AuthError("User not found.", 404);
  return user.universityId;
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
  const universityId = await getActorUniversityId(actor);

  if (actor.role === "ADMIN") {
    if (targetType === "ALL") return;
    if (targetType === "DEPARTMENT") {
      const department = targetDepartmentId
        ? await prisma.department.findUnique({ where: { id: targetDepartmentId }, select: { universityId: true } })
        : null;
      if (!department || department.universityId !== universityId) {
        throw new AuthError("Department is outside your university.", 403);
      }
    }
    if (targetType === "BATCH") {
      const batch = targetBatchId
        ? await prisma.batch.findUnique({ where: { id: targetBatchId }, select: { department: { select: { universityId: true } } } })
        : null;
      if (!batch || batch.department.universityId !== universityId) {
        throw new AuthError("Batch is outside your university.", 403);
      }
    }
    if (targetType === "STUDENT") {
      const student = targetStudentId
        ? await prisma.studentProfile.findUnique({ where: { userId: targetStudentId }, select: { user: { select: { universityId: true, role: true } } } })
        : null;
      if (!student || student.user.role !== "STUDENT" || student.user.universityId !== universityId) {
        throw new AuthError("Student is outside your university.", 403);
      }
    }
    return;
  }

  if (actor.role === "MODERATOR") {
    const mod = await prisma.moderatorProfile.findUnique({ where: { userId: actor.sub } });
    if (!mod) throw new AuthError("Moderator profile not found.", 403);
    await requireModeratorOwnsDepartment(actor, mod.departmentId);

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
      const student = await prisma.studentProfile.findUnique({ where: { userId: targetStudentId }, select: { departmentId: true, user: { select: { universityId: true, role: true } } } });
      if (!student || student.user.role !== "STUDENT" || student.departmentId !== mod.departmentId || student.user.universityId !== universityId) {
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

    const mentorProfile = await prisma.mentorProfile.findUnique({ where: { userId: actor.sub }, select: { departmentId: true, department: { select: { universityId: true } } } });
    if (!mentorProfile) throw new AuthError("Mentor profile not found.", 403);
    if (mentorProfile.department.universityId !== universityId) throw new AuthError("Mentor profile is outside your university.", 403);
    const mentorBatches = await prisma.mentorBatch.findMany({
      where: { mentorId: actor.sub },
      select: { batchId: true, batch: { select: { departmentId: true, department: { select: { universityId: true } } } } },
    });
    if (mentorBatches.some((mb) => mb.batch.departmentId !== mentorProfile.departmentId || mb.batch.department.universityId !== universityId)) {
      throw new AuthError("Assigned batch falls outside your department.", 403);
    }
    const batchIds = new Set(mentorBatches.map((mb) => mb.batchId));

    if (targetType === "BATCH") {
      if (!targetBatchId || !batchIds.has(targetBatchId)) {
        throw new AuthError("You are not assigned to this batch.", 403);
      }
    }
    if (targetType === "STUDENT") {
      if (!targetStudentId) throw new AuthError("Student ID required for STUDENT target.", 400);
      const membership = await prisma.studentBatch.findFirst({
        where: {
          studentId: targetStudentId,
          batchId: { in: Array.from(batchIds) },
          leftAt: null,
          student: { departmentId: mentorProfile.departmentId, user: { universityId, role: "STUDENT" } },
        },
      });
      if (!membership) {
        throw new AuthError("Student is not in any of your assigned batches.", 403);
      }
    }
    return;
  }

  throw new AuthError("Students cannot create notices.", 403);
}

export async function notifyNoticeRecipients(noticeId: string) {
  try {
    const notice = await prisma.notice.findUnique({
      where: { id: noticeId },
      include: { createdBy: { select: { universityId: true } } },
    });
    if (!notice || notice.status !== "ACTIVE") return;
    const now = new Date();
    if ((notice.publishAt && notice.publishAt > now) || (notice.expiryAt && notice.expiryAt <= now)) return;

    let userIds: string[] = [];
    if (notice.targetType === "STUDENT" && notice.targetStudentId) {
      const target = await prisma.studentProfile.findFirst({
        where: {
          userId: notice.targetStudentId,
          department: { universityId: notice.createdBy.universityId },
          user: { universityId: notice.createdBy.universityId, role: "STUDENT" },
        },
        select: { userId: true },
      });
      if (target) userIds = [target.userId];
    } else if (notice.targetType === "BATCH" && notice.targetBatchId) {
      const batch = await prisma.batch.findFirst({
        where: { id: notice.targetBatchId, department: { universityId: notice.createdBy.universityId } },
        select: { departmentId: true },
      });
      if (!batch) return;
      const students = await prisma.studentBatch.findMany({
        where: {
          batchId: notice.targetBatchId,
          leftAt: null,
          student: {
            departmentId: batch.departmentId,
            user: { universityId: notice.createdBy.universityId, role: "STUDENT" },
          },
        },
        select: { studentId: true },
      });
      userIds = students.map(({ studentId }) => studentId);
    } else {
      const departmentId = notice.targetType === "DEPARTMENT" ? notice.targetDepartmentId : undefined;
      userIds = (await prisma.user.findMany({
        where: {
          universityId: notice.createdBy.universityId,
          status: "ACTIVE",
          ...(departmentId
            ? {
                OR: [
                  { studentProfile: { is: { departmentId, department: { universityId: notice.createdBy.universityId } } } },
                  { mentorProfile: { is: { departmentId, department: { universityId: notice.createdBy.universityId } } } },
                  { moderatorProfile: { is: { departmentId, department: { universityId: notice.createdBy.universityId } } } },
                ],
              }
            : {}),
        },
        select: { id: true },
      })).map(({ id }) => id);
    }

    userIds = Array.from(new Set(userIds));

    await createUserNotifications(userIds, {
      type: "NOTICE",
      title: notice.title,
      message: notice.message,
      href: "/",
      sourceKey: `notice:${notice.id}`,
      noticeId: notice.id,
    }, "inAppNotices");

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true, role: true, universityId: true },
    });
    await sendTemplatedEmailToUsers(users, {
      key: "NOTICE",
      type: "NOTICE",
      preference: "emailNotices",
      dedupeKey: (userId) => `notice:${notice.id}:${userId}`,
      relatedNoticeId: notice.id,
      variables: (user) => ({ name: user.name ?? "there", title: notice.title, message: notice.message, url: `${process.env.APP_URL ?? ""}/${user.role?.toLowerCase() ?? "student"}/dashboard` }),
    });
  } catch {
    // Notice persistence must not depend on inbox or email delivery.
  }
}

export async function dispatchDueNoticeNotifications(now = new Date()) {
  const notices = await prisma.notice.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ publishAt: null }, { publishAt: { lte: now } }],
      AND: [{ OR: [{ expiryAt: null }, { expiryAt: { gt: now } }] }],
    },
    select: { id: true },
  });
  for (const notice of notices) await notifyNoticeRecipients(notice.id);
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

  await notifyNoticeRecipients(notice.id);

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
      select: { departmentId: true, department: { select: { universityId: true } }, user: { select: { universityId: true } } },
    });
    if (!student) throw new AuthError("Student profile not found.", 404);
    if (student.department.universityId !== student.user.universityId) throw new AuthError("Student profile is outside its university.", 403);

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
              { targetType: "ALL", createdBy: { universityId: student.user.universityId } },
              { targetType: "DEPARTMENT", targetDepartmentId: student.departmentId },
              { targetType: "BATCH", targetBatchId: { in: batchIds }, targetBatch: { departmentId: student.departmentId, department: { universityId: student.user.universityId } } },
              { targetType: "STUDENT", targetStudentId: actor.sub, createdBy: { universityId: student.user.universityId } },
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

    const mentorProfile = await prisma.mentorProfile.findUnique({ where: { userId: actor.sub }, select: { departmentId: true, department: { select: { universityId: true } } } });
    if (!mentorProfile) throw new AuthError("Mentor profile not found.", 403);
    if (mentorProfile.department.universityId !== await getActorUniversityId(actor)) throw new AuthError("Mentor profile is outside your university.", 403);
    const mentorBatches = await prisma.mentorBatch.findMany({
      where: { mentorId: actor.sub },
      select: { batchId: true },
    });
    const batchIds = mentorBatches.map((mb) => mb.batchId);
    const recipientTargets: Prisma.NoticeWhereInput[] = [
      { targetType: "ALL", createdBy: { universityId: mentorProfile.department.universityId } },
      { targetType: "DEPARTMENT", targetDepartmentId: mentorProfile.departmentId },
      { targetType: "BATCH", targetBatchId: { in: batchIds }, targetBatch: { department: { universityId: mentorProfile.department.universityId } } },
      { targetType: "STUDENT", targetStudent: { departmentId: mentorProfile.departmentId, studentBatches: { some: { batchId: { in: batchIds }, leftAt: null } } } },
    ];

    const where: Prisma.NoticeWhereInput = {
      status: opts.status ?? "ACTIVE",
      OR: [
        { createdById: actor.sub },
        { AND: [{ OR: recipientTargets }, { OR: [{ publishAt: null }, { publishAt: { lte: now } }] }, { OR: [{ expiryAt: null }, { expiryAt: { gt: now } }] }] },
      ],
    };

    return prisma.notice.findMany({
      where: {
        ...where,
        ...(opts.batchId ? { targetBatchId: opts.batchId } : {}),
      },
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
    await requireModeratorOwnsDepartment(actor, mod.departmentId);
    const moderatorUser = await prisma.user.findUnique({ where: { id: actor.sub }, select: { universityId: true } });
    if (!moderatorUser) throw new AuthError("Moderator not found.", 404);

    return prisma.notice.findMany({
      where: {
        status: opts.status ?? "ACTIVE",
        OR: [
          { createdById: actor.sub },
          { AND: [
            { OR: [
              { targetType: "ALL", createdBy: { universityId: moderatorUser.universityId } },
              { targetType: "DEPARTMENT", targetDepartmentId: mod.departmentId },
              { targetType: "BATCH", targetBatch: { departmentId: mod.departmentId } },
              { targetType: "STUDENT", targetStudent: { departmentId: mod.departmentId } },
            ] },
            { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
            { OR: [{ expiryAt: null }, { expiryAt: { gt: now } }] },
          ] },
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

  const universityId = await getActorUniversityId(actor);
  return prisma.notice.findMany({
    where: {
      status: opts.status,
      AND: [
        {
          OR: [
            { targetType: "ALL", createdBy: { universityId } },
            { targetType: "DEPARTMENT", targetDepartment: { universityId } },
            { targetType: "BATCH", targetBatch: { department: { universityId } } },
            { targetType: "STUDENT", targetStudent: { user: { universityId } } },
          ],
        },
        ...(opts.batchId ? [{ targetBatchId: opts.batchId }] : []),
        ...(opts.departmentId ? [{ targetDepartmentId: opts.departmentId }] : []),
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

export async function getNotice(actor: AccessTokenPayload, noticeId: string) {
  const notices = await listNotices(actor, { status: "ACTIVE" });
  const notice = notices.find((item) => item.id === noticeId);
  if (!notice) throw new AuthError("Notice not found.", 404);
  return notice;
}

export async function updateNotice(actor: AccessTokenPayload, noticeId: string, input: UpdateNoticeInput) {
  const notice = await prisma.notice.findUnique({ where: { id: noticeId } });
  if (!notice) throw new AuthError("Notice not found.", 404);

  await getNotice(actor, noticeId);

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
  const publishAt = input.publishAt !== undefined ? input.publishAt : notice.publishAt?.toISOString();
  const expiryAt = input.expiryAt !== undefined ? input.expiryAt : notice.expiryAt?.toISOString();
  if (publishAt && expiryAt && new Date(expiryAt) <= new Date(publishAt)) {
    throw new AuthError("Expiry date must be after publish date.", 400);
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

  await notifyNoticeRecipients(noticeId);

  return updated;
}

export async function archiveNotice(actor: AccessTokenPayload, noticeId: string) {
  const notice = await prisma.notice.findUnique({ where: { id: noticeId } });
  if (!notice) throw new AuthError("Notice not found.", 404);

  await getNotice(actor, noticeId);

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
