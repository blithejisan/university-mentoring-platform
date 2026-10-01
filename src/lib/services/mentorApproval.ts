import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { sendEmail } from "@/lib/email/sender";
import { renderEmailTemplate } from "@/lib/email/templates";
import { getAppUrl } from "@/lib/app-url";
import { AuthError } from "@/lib/auth/guards";
import type { AccessTokenPayload } from "@/lib/auth/jwt";

/**
 * The one place that decides whether `actor` may review a given
 * mentor's application. ADMIN can review any department; MODERATOR can
 * only review their own department's mentors. Every approve/reject/list
 * operation below calls this — there is no second code path that skips
 * it, which is what prevents a moderator from reaching another
 * department's mentor via a crafted request.
 */
async function assertCanReview(
  actor: AccessTokenPayload,
  mentorDepartmentId: string
): Promise<void> {
  const [department, actorUser] = await Promise.all([
    prisma.department.findUnique({
      where: { id: mentorDepartmentId },
      select: { universityId: true },
    }),
    prisma.user.findUnique({
      where: { id: actor.sub },
      select: { universityId: true },
    }),
  ]);
  if (!department || !actorUser || department.universityId !== actorUser.universityId) {
    throw new AuthError("Not authorized to review mentors outside your university.", 403);
  }

  if (actor.role === "ADMIN") return;

  if (actor.role === "MODERATOR") {
    const moderatorProfile = await prisma.moderatorProfile.findUnique({
      where: { userId: actor.sub },
    });
    if (!moderatorProfile || moderatorProfile.departmentId !== mentorDepartmentId) {
      throw new AuthError("Not authorized to review mentors outside your department.", 403);
    }
    return;
  }

  throw new AuthError("Not authorized to review mentor applications.", 403);
}

export interface PendingMentorSummary {
  userId: string;
  universityIdNumber: string;
  email: string;
  departmentId: string;
  departmentName: string;
  registeredAt: Date;
}

export async function listPendingMentors(
  actor: AccessTokenPayload
): Promise<PendingMentorSummary[]> {
  if (actor.role !== "ADMIN" && actor.role !== "MODERATOR") {
    throw new AuthError("Not authorized to view mentor applications.", 403);
  }

  let departmentFilter: string | undefined;
  const actorUser = await prisma.user.findUnique({
    where: { id: actor.sub },
    select: { universityId: true },
  });
  if (!actorUser) {
    throw new AuthError("Not authorized to view mentor applications.", 403);
  }
  if (actor.role === "MODERATOR") {
    const moderatorProfile = await prisma.moderatorProfile.findUnique({
      where: { userId: actor.sub },
    });
    if (!moderatorProfile) {
      throw new AuthError("No moderator profile found for this account.", 403);
    }
    departmentFilter = moderatorProfile.departmentId;
  }

  const mentors = await prisma.mentorProfile.findMany({
    where: {
      approvalStatus: "PENDING_APPROVAL",
      department: { universityId: actorUser.universityId },
      ...(departmentFilter ? { departmentId: departmentFilter } : {}),
    },
    include: { user: true, department: true },
    orderBy: { user: { createdAt: "asc" } },
  });

  return mentors.map((m) => ({
    userId: m.userId,
    universityIdNumber: m.user.universityIdNumber,
    email: m.user.email,
    departmentId: m.departmentId,
    departmentName: m.department.name,
    registeredAt: m.user.createdAt,
  }));
}

async function loadMentorForReview(mentorUserId: string) {
  const mentor = await prisma.mentorProfile.findUnique({
    where: { userId: mentorUserId },
    include: { user: true, department: { include: { university: true } } },
  });
  if (!mentor) {
    throw new AuthError("Mentor application not found.", 403);
  }
  return mentor;
}

export async function approveMentor(actor: AccessTokenPayload, mentorUserId: string) {
  const mentor = await loadMentorForReview(mentorUserId);
  await assertCanReview(actor, mentor.departmentId);

  if (mentor.approvalStatus !== "PENDING_APPROVAL") {
    throw new AuthError(
      `This application is already ${mentor.approvalStatus.toLowerCase()}.`,
      403
    );
  }

  const now = new Date();

  await prisma.$transaction([
    prisma.mentorProfile.update({
      where: { userId: mentorUserId },
      data: { approvalStatus: "APPROVED", approvedById: actor.sub, approvedAt: now },
    }),
    prisma.user.update({
      where: { id: mentorUserId },
      data: { status: "ACTIVE" },
    }),
  ]);

  await writeAuditLog({
    actorId: actor.sub,
    actorRole: actor.role,
    action: "MENTOR_APPROVED",
    targetType: "User",
    targetId: mentorUserId,
    previousValue: { approvalStatus: "PENDING_APPROVAL" },
    newValue: { approvalStatus: "APPROVED", approvedBy: actor.sub, approvedAt: now.toISOString() },
  });

  const { subject, html, text } = await renderEmailTemplate("MENTOR_APPROVED", {
    name: mentor.user.name ?? "",
    studentId: mentor.user.universityIdNumber,
    universityName: mentor.department.university.name,
    department: mentor.department.name,
    decisionDate: now.toLocaleDateString(),
    loginUrl: getAppUrl("/login"),
  });

  const result = await sendEmail({ to: mentor.user.email, subject, html, text });
  await prisma.emailLog.create({
    data: {
      recipient: mentor.user.email,
      type: "MENTOR_APPROVED",
      status: result.success ? "SENT" : "FAILED",
      error: result.error,
      sentAt: result.success ? now : undefined,
    },
  });

  return { userId: mentorUserId, approvalStatus: "APPROVED" as const };
}

export async function rejectMentor(
  actor: AccessTokenPayload,
  mentorUserId: string,
  reason: string
) {
  if (!reason || !reason.trim()) {
    throw new AuthError("A rejection reason is required.", 403);
  }

  const mentor = await loadMentorForReview(mentorUserId);
  await assertCanReview(actor, mentor.departmentId);

  if (mentor.approvalStatus !== "PENDING_APPROVAL") {
    throw new AuthError(
      `This application is already ${mentor.approvalStatus.toLowerCase()}.`,
      403
    );
  }

  const now = new Date();

  await prisma.$transaction([
    prisma.mentorProfile.update({
      where: { userId: mentorUserId },
      data: {
        approvalStatus: "REJECTED",
        rejectedById: actor.sub,
        rejectedAt: now,
        rejectionReason: reason.trim(),
      },
    }),
    prisma.user.update({
      where: { id: mentorUserId },
      data: { status: "REJECTED" },
    }),
  ]);

  await writeAuditLog({
    actorId: actor.sub,
    actorRole: actor.role,
    action: "MENTOR_REJECTED",
    targetType: "User",
    targetId: mentorUserId,
    previousValue: { approvalStatus: "PENDING_APPROVAL" },
    newValue: { approvalStatus: "REJECTED", rejectedBy: actor.sub, rejectedAt: now.toISOString() },
    reason: reason.trim(),
  });

  const { subject, html, text } = await renderEmailTemplate("MENTOR_REJECTED", {
    name: mentor.user.name ?? "",
    studentId: mentor.user.universityIdNumber,
    universityName: mentor.department.university.name,
    department: mentor.department.name,
    decisionDate: now.toLocaleDateString(),
    rejectionReason: reason.trim(),
  });

  const result = await sendEmail({ to: mentor.user.email, subject, html, text });
  await prisma.emailLog.create({
    data: {
      recipient: mentor.user.email,
      type: "MENTOR_REJECTED",
      status: result.success ? "SENT" : "FAILED",
      error: result.error,
      sentAt: result.success ? now : undefined,
    },
  });

  return { userId: mentorUserId, approvalStatus: "REJECTED" as const };
}
