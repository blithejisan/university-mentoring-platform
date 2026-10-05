import type { EmailType, NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { renderEmailTemplate, type EmailTemplateKey } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/sender";
import { AuthError, requireApprovedMentor, requireModeratorOwnsDepartment } from "@/lib/auth/guards";
import type { AccessTokenPayload } from "@/lib/auth/jwt";
import { pusherServer } from "@/lib/pusher-server";

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  inAppNotices: true,
  emailNotices: true,
  inAppSessions: true,
  emailSessionReminders: true,
  inAppRemarks: true,
  emailRemarks: true,
  inAppCoordination: true,
};

export type NotificationPreferenceKey = keyof typeof DEFAULT_NOTIFICATION_PREFERENCES;

export async function getNotificationPreferences(userId: string) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export async function updateNotificationPreferences(
  userId: string,
  values: Partial<typeof DEFAULT_NOTIFICATION_PREFERENCES>
) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...values },
    update: values,
  });
}

export async function listNotifications(actor: AccessTokenPayload) {
  const actorUser = await prisma.user.findUnique({ where: { id: actor.sub }, select: { universityId: true } });
  if (!actorUser) throw new AuthError("User not found.", 404);
  const [student, mentor, moderator, assignments, memberships] = await Promise.all([
    actor.role === "STUDENT" || actor.role === "MENTOR" ? prisma.studentProfile.findUnique({ where: { userId: actor.sub }, select: { departmentId: true, enrolledBatchId: true, user: { select: { universityId: true, status: true } } } }) : null,
    actor.role === "MENTOR" ? prisma.mentorProfile.findUnique({ where: { userId: actor.sub }, select: { departmentId: true, approvalStatus: true, department: { select: { universityId: true } } } }) : null,
    actor.role === "MODERATOR" ? prisma.moderatorProfile.findUnique({ where: { userId: actor.sub }, select: { departmentId: true } }) : null,
    actor.role === "MENTOR" ? prisma.mentorBatch.findMany({ where: { mentorId: actor.sub }, select: { batchId: true } }) : [],
    actor.role === "STUDENT" || actor.role === "MENTOR" ? prisma.studentBatch.findMany({ where: { studentId: actor.sub, leftAt: null }, select: { batchId: true } }) : [],
  ]);
  if (actor.role === "MENTOR") {
    await requireApprovedMentor(actor);
    if (!mentor || mentor.department.universityId !== actorUser.universityId) throw new AuthError("Mentor profile is outside your university.", 403);
  }
  if (actor.role === "MODERATOR") {
    if (!moderator) throw new AuthError("Moderator profile not found.", 403);
    await requireModeratorOwnsDepartment(actor, moderator.departmentId);
  }
  if (actor.role === "STUDENT" && (!student || student.user.status !== "ACTIVE" || student.user.universityId !== actorUser.universityId)) {
    throw new AuthError("Student profile is outside your university.", 403);
  }
  const batchIds = new Set(assignments.map((item) => item.batchId));
  const studentBatchIds = new Set(memberships.map((item) => item.batchId));

  const notifications = await prisma.notification.findMany({
    where: { userId: actor.sub },
    include: {
      notice: {
        include: {
          createdBy: { select: { universityId: true } },
          targetBatch: { select: { department: { select: { universityId: true, id: true } } } },
          targetDepartment: { select: { universityId: true } },
          targetStudent: { select: { departmentId: true, user: { select: { universityId: true } }, studentBatches: { where: { leftAt: null }, select: { batchId: true } } } },
        },
      },
      batchNotice: { include: { batch: { include: { department: true } } } },
      session: { include: { batch: { include: { department: true } } } },
      supportNote: {
        include: {
          batch: { include: { department: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const visible = notifications.filter((notification) => {
    if (notification.batchNotice) {
      const notice = notification.batchNotice;
      return (
        !!student &&
        student.user.status === "ACTIVE" &&
        student.user.universityId === actorUser.universityId &&
        notice.batch.departmentId === student.departmentId &&
        notice.batch.department.universityId === actorUser.universityId &&
        (student.enrolledBatchId === notice.batchId || studentBatchIds.has(notice.batchId))
      );
    }
    if (notification.notice) {
      const notice = notification.notice;
      const now = new Date();
      if (notice.status !== "ACTIVE" || (notice.publishAt && notice.publishAt > now) || (notice.expiryAt && notice.expiryAt <= now)) return false;
      if (actor.role === "ADMIN") {
        return notice.createdBy.universityId === actorUser.universityId
          && (notice.targetType === "ALL"
            || notice.targetDepartment?.universityId === actorUser.universityId
            || notice.targetBatch?.department.universityId === actorUser.universityId
            || notice.targetStudent?.user.universityId === actorUser.universityId);
      }
      if (actor.role === "STUDENT") {
        return !!student && (
          (notice.targetType === "ALL" && notice.createdBy.universityId === actorUser.universityId)
          || (notice.targetType === "DEPARTMENT" && notice.targetDepartmentId === student.departmentId)
          || (notice.targetType === "BATCH" && !!notice.targetBatchId && !!notice.targetBatch && studentBatchIds.has(notice.targetBatchId) && notice.targetBatch.department.id === student.departmentId && notice.targetBatch.department.universityId === actorUser.universityId)
          || (notice.targetType === "STUDENT" && notice.targetStudentId === actor.sub && notice.targetStudent?.user.universityId === actorUser.universityId)
        );
      }
      if (actor.role === "MODERATOR") {
        return !!moderator && notice.createdBy.universityId === actorUser.universityId && (
          notice.createdById === actor.sub
          || (notice.targetType === "ALL" && notice.createdBy.universityId === actorUser.universityId)
          || (notice.targetType === "DEPARTMENT" && notice.targetDepartmentId === moderator.departmentId)
          || (notice.targetType === "BATCH" && notice.targetBatch?.department.id === moderator.departmentId)
          || (notice.targetType === "STUDENT" && notice.targetStudent?.departmentId === moderator.departmentId)
        );
      }
      return !!mentor && mentor.approvalStatus === "APPROVED" && notice.createdBy.universityId === actorUser.universityId && (
        notice.createdById === actor.sub
        || notice.targetType === "ALL"
        || (notice.targetType === "DEPARTMENT" && notice.targetDepartmentId === mentor.departmentId)
        || (notice.targetType === "BATCH" && !!notice.targetBatchId && batchIds.has(notice.targetBatchId) && notice.targetBatch?.department.id === mentor.departmentId)
        || (notice.targetType === "STUDENT" && notice.targetStudent?.departmentId === mentor.departmentId && notice.targetStudent.studentBatches.some((membership) => batchIds.has(membership.batchId)))
      );
    }
    if (notification.session) {
      const session = notification.session;
      if (notification.sourceKey.startsWith("session-reminder:") && session.status !== "SCHEDULED") return false;
      if (notification.sourceKey.startsWith("session-reminder:") && (session.startTime ?? session.date).toISOString() !== notification.sourceKey.split(":").at(-1)) return false;
      if (actor.role === "STUDENT") {
        return session.batch.department.universityId === actorUser.universityId && session.batch.departmentId === student?.departmentId && studentBatchIds.has(session.batchId);
      }
      if (actor.role === "MENTOR") {
        return mentor?.approvalStatus === "APPROVED" && session.mentorId === actor.sub && batchIds.has(session.batchId) && session.batch.departmentId === mentor.departmentId;
      }
      if (actor.role === "MODERATOR") return !!moderator && session.batch.departmentId === moderator.departmentId && session.batch.department.universityId === actorUser.universityId;
      return session.batch.department.universityId === actorUser.universityId;
    }
    if (notification.supportNote) {
      const supportNote = notification.supportNote;
      if (actor.role === "MENTOR") {
        return mentor?.approvalStatus === "APPROVED"
          && batchIds.has(supportNote.batchId)
          && supportNote.batch.departmentId === mentor.departmentId
          && supportNote.batch.department.universityId === actorUser.universityId;
      }
      if (actor.role === "MODERATOR") {
        return !!moderator
          && supportNote.batch.departmentId === moderator.departmentId
          && supportNote.batch.department.universityId === actorUser.universityId;
      }
      if (actor.role === "ADMIN") {
        return supportNote.batch.department.universityId === actorUser.universityId;
      }
      return false;
    }
    return true;
  });

  return {
    notifications: visible.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      message: item.message,
      href: item.href,
      readAt: item.readAt,
      createdAt: item.createdAt,
    })),
    unreadCount: visible.filter((item) => !item.readAt).length,
  };
}

export async function setNotificationReadState(actor: AccessTokenPayload, id: string, read: boolean) {
  const result = await prisma.notification.updateMany({
    where: { id, userId: actor.sub },
    data: { readAt: read ? new Date() : null },
  });
  if (result.count === 0) throw new AuthError("Notification not found.", 404);
}

export async function createUserNotifications(
  userIds: string[],
  input: {
    type: NotificationType;
    title: string;
    message: string;
    href?: string;
    sourceKey: string;
    noticeId?: string;
    sessionId?: string;
    supportNoteId?: string;
    batchNoticeId?: string;
  },
  preference: NotificationPreferenceKey
) {
  if (userIds.length === 0) return;
  try {
    const uniqueUserIds = Array.from(new Set(userIds));
    const preferences = await prisma.notificationPreference.findMany({
      where: { userId: { in: uniqueUserIds } },
      select: {
        userId: true,
        inAppNotices: true,
        emailNotices: true,
        inAppSessions: true,
        emailSessionReminders: true,
        inAppRemarks: true,
        emailRemarks: true,
        inAppCoordination: true,
      },
    });
    const disabled = new Set(
      preferences.filter((item) => !item[preference]).map((item) => item.userId)
    );
    const data = uniqueUserIds
      .filter((userId) => !disabled.has(userId))
      .map((userId) => ({ userId, ...input }));
    if (data.length > 0) {
      const createdNotifications = await prisma.notification.createManyAndReturn({
        data,
        skipDuplicates: true,
      });
      await Promise.all(
        createdNotifications.map(async (notification) => {
          try {
            if (!pusherServer) return;
            await pusherServer.trigger(
              `private-user-${notification.userId}`,
              "notification:new",
              {
                id: notification.id,
                title: notification.title,
                message: notification.message,
                href: notification.href,
                readAt: notification.readAt,
                createdAt: notification.createdAt,
              }
            );
          } catch (error) {
            console.error(
              `[notification-pusher] Failed to publish notification ${notification.id}.`,
              error
            );
          }
        })
      );
    }
  } catch (error) {
    console.error("[notification] Failed to persist in-app notifications.", error);
  }
}

export async function sendTemplatedEmailToUsers(
  users: Array<{ id: string; email: string; name?: string | null; role?: string; universityId?: string }>,
  input: {
    key: EmailTemplateKey;
    type: EmailType;
    preference: NotificationPreferenceKey;
    dedupeKey: (userId: string) => string;
    variables: (user: { id: string; email: string; name?: string | null; role?: string; universityId?: string }) => Record<string, string>;
    relatedNoticeId?: string;
    relatedSessionId?: string;
  }
) {
  if (users.length === 0) return;

  let preferences;
  try {
    preferences = await prisma.notificationPreference.findMany({
      where: { userId: { in: users.map((user) => user.id) } },
      select: {
        userId: true,
        inAppNotices: true,
        emailNotices: true,
        inAppSessions: true,
        emailSessionReminders: true,
        inAppRemarks: true,
        emailRemarks: true,
        inAppCoordination: true,
      },
    });
  } catch {
    return;
  }
  const byUser = new Map(preferences.map((value) => [value.userId, value]));

  for (const user of users) {
    const preference = byUser.get(user.id);
    if (preference && preference[input.preference] === false) continue;

    const dedupeKey = input.dedupeKey(user.id);
    try {
      await prisma.emailLog.create({
        data: {
          recipient: user.email,
          relatedNoticeId: input.relatedNoticeId,
          relatedSessionId: input.relatedSessionId,
          dedupeKey,
          type: input.type,
          status: "QUEUED",
        },
      });
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "P2002")) continue;
      try {
        const existing = await prisma.emailLog.findUnique({ where: { dedupeKey } });
        if (!existing || existing.status !== "FAILED") continue;
        await prisma.emailLog.update({ where: { id: existing.id }, data: { status: "QUEUED", error: null } });
      } catch {
        continue;
      }
    }

    try {
      const template = await renderEmailTemplate(input.key, input.variables(user), user.universityId);
      const result = await sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
      await prisma.emailLog.update({
        where: { dedupeKey },
        data: {
          status: result.success ? "SENT" : "FAILED",
          error: result.error ?? null,
          sentAt: result.success ? new Date() : null,
        },
      });
    } catch (error) {
      try {
        await prisma.emailLog.update({
          where: { dedupeKey },
          data: { status: "FAILED", error: error instanceof Error ? error.message : "Email delivery failed." },
        });
      } catch {
        // Delivery failures are best-effort and must not block the caller.
      }
    }
  }
}
