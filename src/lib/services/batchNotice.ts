import { prisma } from "@/lib/prisma";
import { AuthError, requireApprovedMentor } from "@/lib/auth/guards";
import type { AccessTokenPayload } from "@/lib/auth/jwt";
import type { CreateBatchNoticeInput } from "@/lib/validation/batch-notice";
import { createUserNotifications } from "@/lib/services/notification";

async function getNoticeBatches(actor: AccessTokenPayload) {
  if (actor.role === "ADMIN") {
    const admin = await prisma.user.findUnique({
      where: { id: actor.sub },
      select: { universityId: true },
    });
    if (!admin) throw new AuthError("Admin account not found.", 404);
    const batches = await prisma.batch.findMany({
      where: { department: { universityId: admin.universityId } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return { batches, crBatchId: null, canManageNotices: false };
  }

  if (actor.role !== "STUDENT" && actor.role !== "MENTOR") {
    throw new AuthError("Only students, mentors, and admins can access the batch noticeboard.", 403);
  }

  if (actor.role === "MENTOR") await requireApprovedMentor(actor);

  const user = await prisma.user.findUnique({
    where: { id: actor.sub },
    select: {
      role: true,
      isCR: true,
      crStatus: true,
      crBatchId: true,
      status: true,
      universityId: true,
      studentProfile: {
        select: {
          departmentId: true,
          department: { select: { universityId: true } },
          enrolledBatch: {
            select: {
              id: true,
              name: true,
              departmentId: true,
              department: { select: { universityId: true } },
            },
          },
          studentBatches: {
            where: { leftAt: null },
            select: {
              batch: {
                select: {
                  id: true,
                  name: true,
                  departmentId: true,
                  department: { select: { universityId: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (
    !user ||
    user.role !== actor.role ||
    user.status !== "ACTIVE" ||
    !user.studentProfile ||
    user.studentProfile.department.universityId !== user.universityId
  ) {
    throw new AuthError("Active student profile not found.", 403);
  }

  const batches = [
    ...user.studentProfile.studentBatches.map(({ batch }) => batch),
    ...(user.studentProfile.enrolledBatch ? [user.studentProfile.enrolledBatch] : []),
  ]
    .filter((batch, index, all) => all.findIndex(({ id }) => id === batch.id) === index)
    .filter(
      (batch) =>
        batch.departmentId === user.studentProfile?.departmentId &&
        batch.department.universityId === user.universityId
    )
    .map(({ id, name }) => ({ id, name }));
  const hasApprovedCRAccess =
    user.isCR &&
    user.crStatus === "APPROVED" &&
    Boolean(user.crBatchId) &&
    batches.some(({ id }) => id === user.crBatchId);

  return {
    batches,
    crBatchId: hasApprovedCRAccess ? user.crBatchId : null,
    canManageNotices: hasApprovedCRAccess,
  };
}

export async function listBatchNotices(actor: AccessTokenPayload, batchId?: string) {
  const { batches, crBatchId, canManageNotices } = await getNoticeBatches(actor);
  let visibleBatches = batches;

  if (batchId) {
    const selected = batches.find((batch) => batch.id === batchId);
    if (!selected) throw new AuthError("Not authorized to access this batch.", 403);
    visibleBatches = [selected];
  }

  if (actor.role === "ADMIN" && !batchId) {
    return { batches, notices: [], canCreateNotice: false, canManageNotices: false };
  }

  const batchIds = visibleBatches.map(({ id }) => id);
  const notices = batchIds.length
    ? await prisma.batchNotice.findMany({
        where: { batchId: { in: batchIds } },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        include: {
          author: { select: { id: true, name: true } },
          batch: { select: { id: true, name: true } },
        },
      })
    : [];

  return {
    batches,
    notices: notices.map((notice) => ({
      ...notice,
      canDelete: actor.role === "ADMIN" || (canManageNotices && notice.author.id === actor.sub),
    })),
    canCreateNotice: Boolean(crBatchId && visibleBatches.some(({ id }) => id === crBatchId)),
    canManageNotices,
  };
}

export async function dispatchBatchNoticeNotifications(noticeId: string) {
  const notice = await prisma.batchNotice.findUnique({
    where: { id: noticeId },
    include: {
      batch: { select: { id: true, departmentId: true, department: { select: { universityId: true } } } },
    },
  });
  if (!notice) return;

  const recipients = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      isRegistered: true,
      universityId: notice.batch.department.universityId,
      studentProfile: {
        is: {
          departmentId: notice.batch.departmentId,
          OR: [
            { enrolledBatchId: notice.batchId },
            { studentBatches: { some: { batchId: notice.batchId, leftAt: null } } },
          ],
        },
      },
    },
    select: { id: true },
  });
  await createUserNotifications(
    recipients.map(({ id }) => id),
    {
      type: "NOTICE",
      title: notice.title,
      message: "A new notice was posted to your batch noticeboard.",
      href: `/student/my-batch?batchId=${encodeURIComponent(notice.batchId)}`,
      sourceKey: `batch-notice:${notice.id}`,
      batchNoticeId: notice.id,
    },
    "inAppNotices"
  );
}

export async function createBatchNotice(
  actor: AccessTokenPayload,
  input: CreateBatchNoticeInput
) {
  if (actor.role !== "STUDENT" && actor.role !== "MENTOR") {
    throw new AuthError("Only an approved CR can create batch notices.", 403);
  }

  if (actor.role === "MENTOR") await requireApprovedMentor(actor);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: actor.sub },
      select: {
        role: true,
        isCR: true,
        crStatus: true,
        crBatchId: true,
        status: true,
        studentProfile: {
          select: {
            studentBatches: {
              where: { leftAt: null },
              select: { batchId: true },
            },
          },
        },
        mentorProfile: { select: { approvalStatus: true } },
      },
    });
    if (
      !user ||
      user.role !== actor.role ||
      user.status !== "ACTIVE" ||
      !user.isCR ||
      user.crStatus !== "APPROVED" ||
      !user.crBatchId ||
      !user.studentProfile?.studentBatches.some(({ batchId }) => batchId === user.crBatchId) ||
      (actor.role === "MENTOR" && user.mentorProfile?.approvalStatus !== "APPROVED")
    ) {
      throw new AuthError("Only an approved CR can create batch notices.", 403);
    }

    const batchId = user.crBatchId;
    const lockedBatch = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "batches" WHERE "id" = ${batchId} FOR UPDATE
    `;
    if (!lockedBatch.length) {
      throw new AuthError("Your CR batch was not found.", 403);
    }

    const currentUser = await tx.user.findUnique({
      where: { id: actor.sub },
      select: {
        role: true,
        isCR: true,
        crStatus: true,
        crBatchId: true,
        status: true,
        mentorProfile: { select: { approvalStatus: true } },
      },
    });
    const membership = await tx.studentBatch.findUnique({
      where: { studentId_batchId: { studentId: actor.sub, batchId } },
      select: { leftAt: true },
    });
    if (
      !currentUser ||
      currentUser.role !== actor.role ||
      currentUser.status !== "ACTIVE" ||
      !currentUser.isCR ||
      currentUser.crStatus !== "APPROVED" ||
      currentUser.crBatchId !== batchId ||
      (actor.role === "MENTOR" && currentUser.mentorProfile?.approvalStatus !== "APPROVED") ||
      !membership ||
      membership.leftAt
    ) {
      throw new AuthError("You are no longer an approved CR in this batch.", 403);
    }

    return tx.batchNotice.create({
      data: {
        title: input.title,
        content: input.content,
        batchId,
        authorId: actor.sub,
        isPinned: input.isPinned,
        attachments: input.attachments,
        sendEmailNotification: input.sendEmailNotification,
      },
      include: {
        author: { select: { id: true, name: true } },
        batch: { select: { id: true, name: true } },
      },
    });
  });
}

export async function deleteBatchNotice(actor: AccessTokenPayload, noticeId: string) {
  if (actor.role === "ADMIN") {
    const admin = await prisma.user.findUnique({
      where: { id: actor.sub },
      select: { universityId: true },
    });
    if (!admin) throw new AuthError("Admin account not found.", 404);

    const notice = await prisma.batchNotice.findFirst({
      where: { id: noticeId, batch: { department: { universityId: admin.universityId } } },
      select: { id: true },
    });
    if (!notice) throw new AuthError("Batch notice not found.", 404);
    await prisma.batchNotice.delete({ where: { id: notice.id } });
    return;
  }

  if (actor.role !== "STUDENT" && actor.role !== "MENTOR") {
    throw new AuthError("Not authorized to delete this batch notice.", 403);
  }
  if (actor.role === "MENTOR") await requireApprovedMentor(actor);
  const user = await prisma.user.findUnique({
    where: { id: actor.sub },
    select: {
      status: true,
      isCR: true,
      crStatus: true,
      crBatchId: true,
      studentProfile: {
        select: { studentBatches: { where: { leftAt: null }, select: { batchId: true } } },
      },
      mentorProfile: { select: { approvalStatus: true } },
    },
  });
  if (
    !user ||
    user.status !== "ACTIVE" ||
    !user.isCR ||
    user.crStatus !== "APPROVED" ||
    !user.crBatchId ||
    !user.studentProfile?.studentBatches.some(({ batchId }) => batchId === user.crBatchId) ||
    (actor.role === "MENTOR" && user.mentorProfile?.approvalStatus !== "APPROVED")
  ) {
    throw new AuthError("You are no longer an approved CR in this batch.", 403);
  }
  const notice = await prisma.batchNotice.findFirst({
    where: {
      id: noticeId,
      authorId: actor.sub,
      batchId: user.crBatchId,
    },
    select: { id: true },
  });
  if (!notice) throw new AuthError("Batch notice not found or you are no longer an approved CR.", 404);
  await prisma.batchNotice.delete({ where: { id: notice.id } });
}
