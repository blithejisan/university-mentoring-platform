import { prisma } from "@/lib/prisma";
import { AuthError, requireModeratorOwnsDepartment } from "@/lib/auth/guards";
import type { AccessTokenPayload } from "@/lib/auth/jwt";
import type { SubmitEvaluationInput } from "@/lib/validation/evaluation";
import { writeAuditLog } from "@/lib/audit";

/**
 * Submit a student evaluation for a mentor session.
 *
 * Guards:
 *  - Actor must be STUDENT.
 *  - Session must exist and be COMPLETED.
 *  - Student must be an active member of the session's batch.
 *  - Student must not have already evaluated this session.
 */
export async function submitMentorEvaluation(
  actor: AccessTokenPayload,
  sessionId: string,
  input: SubmitEvaluationInput
) {
  if (actor.role !== "STUDENT") {
    throw new AuthError("Only students can submit mentor evaluations.", 403);
  }

  // Load the session
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    include: { batch: true },
  });
  if (!session) throw new AuthError("Session not found.", 404);
  if (session.status !== "COMPLETED") {
    throw new AuthError("You can only evaluate a completed session.", 400);
  }

  // Check student is in the batch
  const membership = await prisma.studentBatch.findUnique({
    where: {
      studentId_batchId: { studentId: actor.sub, batchId: session.batchId },
    },
  });
  if (!membership) {
    throw new AuthError("You are not a member of this batch.", 403);
  }

  // Ensure mentor profile exists
  const mentorProfile = await prisma.mentorProfile.findUnique({
    where: { userId: session.mentorId },
  });
  if (!mentorProfile) {
    throw new AuthError("Mentor profile not found.", 404);
  }

  // Duplicate check: one evaluation per student per session
  const existing = await prisma.mentorEvaluation.findUnique({
    where: { studentId_sessionId: { studentId: actor.sub, sessionId } },
  });
  if (existing) {
    throw new AuthError(
      "You have already submitted an evaluation for this session.",
      409
    );
  }

  const evaluation = await prisma.mentorEvaluation.create({
    data: {
      studentId: actor.sub,
      mentorId: session.mentorId,
      sessionId,
      batchId: session.batchId,
      overallRating: input.overallRating,
      communicationRating: input.communicationRating ?? null,
      helpfulnessRating: input.helpfulnessRating ?? null,
      sessionQualityRating: input.sessionQualityRating ?? null,
      supportRating: input.supportRating ?? null,
      comment: input.comment ?? null,
    },
  });

  await writeAuditLog({
    actorId: actor.sub,
    actorRole: actor.role,
    action: "MENTOR_EVALUATION_SUBMITTED",
    targetType: "MentorEvaluation",
    targetId: evaluation.id,
    newValue: {
      sessionId,
      mentorId: session.mentorId,
      overallRating: input.overallRating,
    },
  });

  return evaluation;
}

/**
 * Check whether the currently authenticated student has already evaluated
 * a given session.
 */
export async function getEvaluationStatus(
  actor: AccessTokenPayload,
  sessionId: string
) {
  if (actor.role !== "STUDENT") {
    throw new AuthError("Only students can check evaluation status.", 403);
  }

  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true, batchId: true, mentorId: true },
  });
  if (!session) throw new AuthError("Session not found.", 404);

  const membership = await prisma.studentBatch.findUnique({
    where: {
      studentId_batchId: { studentId: actor.sub, batchId: session.batchId },
    },
  });

  const existing = membership
    ? await prisma.mentorEvaluation.findUnique({
        where: {
          studentId_sessionId: { studentId: actor.sub, sessionId },
        },
      })
    : null;

  return {
    sessionStatus: session.status,
    isMember: !!membership,
    hasEvaluated: !!existing,
    evaluation: existing,
  };
}

/**
 * List all evaluations received by the currently-authenticated mentor.
 * Admins and moderators may pass a mentorId query param to view any mentor.
 */
export async function listEvaluationsForMentor(
  actor: AccessTokenPayload,
  mentorId?: string
) {
  let targetMentorId: string;
  let targetScope: { departmentId: string; universityId: string } | undefined;

  if (actor.role === "MENTOR") {
    targetMentorId = actor.sub;
  } else if (actor.role === "ADMIN" || actor.role === "MODERATOR") {
    if (!mentorId) {
      throw new AuthError("mentorId query parameter is required.", 400);
    }
    targetMentorId = mentorId;
    const targetMentor = await prisma.mentorProfile.findUnique({
      where: { userId: targetMentorId },
      select: {
        departmentId: true,
        department: { select: { universityId: true } },
      },
    });
    if (!targetMentor) {
      throw new AuthError("Mentor not found.", 404);
    }
    await requireModeratorOwnsDepartment(actor, targetMentor.departmentId);
    targetScope = {
      departmentId: targetMentor.departmentId,
      universityId: targetMentor.department.universityId,
    };
  } else {
    throw new AuthError("Not authorized.", 403);
  }

  const evaluations = await prisma.mentorEvaluation.findMany({
    where: {
      mentorId: targetMentorId,
      ...(targetScope
        ? {
            mentor: {
              departmentId: targetScope.departmentId,
              department: { universityId: targetScope.universityId },
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      session: {
        select: {
          id: true,
          date: true,
          topic: true,
          status: true,
          batch: { select: { id: true, name: true } },
        },
      },
      student: {
        select: {
          user: { select: { universityIdNumber: true, email: true } },
        },
      },
    },
  });

  // Compute aggregate stats
  const count = evaluations.length;
  const avg = (field: (e: (typeof evaluations)[number]) => number | null) => {
    const vals = evaluations.map(field).filter((v): v is number => v !== null);
    return vals.length > 0
      ? Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10
      : null;
  };

  const stats = {
    totalEvaluations: count,
    averageOverall: avg((e) => e.overallRating),
    averageCommunication: avg((e) => e.communicationRating),
    averageHelpfulness: avg((e) => e.helpfulnessRating),
    averageSessionQuality: avg((e) => e.sessionQualityRating),
    averageSupport: avg((e) => e.supportRating),
  };

  return { evaluations, stats };
}

/**
 * List all completed sessions for the logged-in student's batches,
 * annotated with whether the student has already submitted an evaluation.
 */
export async function listStudentSessionsWithEvaluationStatus(
  actor: AccessTokenPayload
) {
  if (actor.role !== "STUDENT") {
    throw new AuthError("Only students can access this endpoint.", 403);
  }

  // Only current memberships make a batch's sessions relevant to the student.
  const studentBatches = await prisma.studentBatch.findMany({
    where: { studentId: actor.sub, leftAt: null },
    select: { batchId: true, joinedAt: true },
  });

  if (studentBatches.length === 0) return [];

  // Return only fields needed to evaluate a completed session.
  const sessions = await prisma.attendanceSession.findMany({
    where: {
      status: "COMPLETED",
      OR: studentBatches.map((membership) => ({
        batchId: membership.batchId,
        date: { gte: membership.joinedAt },
      })),
    },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      topic: true,
      status: true,
      batch: { select: { id: true, name: true } },
      mentor: { select: { universityIdNumber: true } },
    },
  });

  // Get all evaluations this student has already submitted
  const existingEvals = await prisma.mentorEvaluation.findMany({
    where: { studentId: actor.sub },
    select: { sessionId: true },
  });
  const evaluatedSessionIds = new Set(existingEvals.map((e: { sessionId: string }) => e.sessionId));

  return sessions.map((s) => ({
    ...s,
    hasEvaluated: evaluatedSessionIds.has(s.id),
  }));
}
