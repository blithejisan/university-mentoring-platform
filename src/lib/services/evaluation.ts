import { prisma } from "@/lib/prisma";
import { AuthError, requireModeratorOwnsDepartment } from "@/lib/auth/guards";
import type { AccessTokenPayload } from "@/lib/auth/jwt";
import type { SubmitEvaluationInput } from "@/lib/validation/evaluation";
import { writeAuditLog } from "@/lib/audit";

const MINIMUM_ANONYMOUS_RESPONSES = 3;

/**
 * Submit a student evaluation for a mentor session.
 *
 * Guards:
 *  - Actor must be STUDENT.
 *  - Session must exist and be COMPLETED.
 *  - Student must be an active member of the session's batch.
 *  - Student must not have already evaluated this mentor for this session.
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
    include: { batch: true, sessionMentors: { select: { mentorId: true } } },
  });
  if (!session) throw new AuthError("Session not found.", 404);
  if (session.status !== "COMPLETED") {
    throw new AuthError("You can only evaluate a completed session.", 400);
  }
  const mentorId = input.mentorId;
  if (!session.sessionMentors.some((assignment) => assignment.mentorId === mentorId)) {
    throw new AuthError("The selected mentor is not assigned to this session.", 400);
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
    where: { userId: mentorId },
  });
  if (!mentorProfile) {
    throw new AuthError("Mentor profile not found.", 404);
  }

  // One response is allowed per student, session, and assigned mentor.
  const existing = await prisma.mentorEvaluation.findUnique({
    where: {
      studentId_sessionId_mentorId: {
        studentId: actor.sub,
        sessionId,
        mentorId,
      },
    },
  });
  if (existing) {
    throw new AuthError(
      "You have already evaluated this mentor for this session.",
      409
    );
  }

  let evaluation;
  try {
    evaluation = await prisma.mentorEvaluation.create({
      data: {
        studentId: actor.sub,
        mentorId,
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
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new AuthError(
        "You have already evaluated this mentor for this session.",
        409
      );
    }
    throw error;
  }

  await writeAuditLog({
    actorId: actor.sub,
    actorRole: actor.role,
    action: "MENTOR_EVALUATION_SUBMITTED",
    targetType: "MentorEvaluation",
    targetId: evaluation.id,
    newValue: {
      sessionId,
      mentorId,
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
  sessionId: string,
  mentorId?: string
) {
  if (actor.role !== "STUDENT") {
    throw new AuthError("Only students can check evaluation status.", 403);
  }

  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      batchId: true,
      sessionMentors: { select: { mentorId: true } },
    },
  });
  if (!session) throw new AuthError("Session not found.", 404);

  const membership = await prisma.studentBatch.findUnique({
    where: {
      studentId_batchId: { studentId: actor.sub, batchId: session.batchId },
    },
  });

  const evaluatedMentorIds = membership
    ? (
        await prisma.mentorEvaluation.findMany({
          where: { studentId: actor.sub, sessionId },
          select: { mentorId: true },
        })
      ).map((evaluation) => evaluation.mentorId)
    : [];

  return {
    sessionStatus: session.status,
    isMember: !!membership,
    evaluatedMentorIds,
    hasEvaluated: mentorId
      ? evaluatedMentorIds.includes(mentorId)
      : session.sessionMentors.every((assignment) =>
          evaluatedMentorIds.includes(assignment.mentorId)
        ),
  };
}

/**
 * Return only anonymous aggregate ratings and sufficiently grouped comments.
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

  const sessions = await prisma.attendanceSession.findMany({
    where: {
      sessionMentors: {
        some: {
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
      },
      status: "COMPLETED",
    },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      topic: true,
      mentorEvaluations: {
        where: { mentorId: targetMentorId },
        select: {
          overallRating: true,
          communicationRating: true,
          helpfulnessRating: true,
          sessionQualityRating: true,
          comment: true,
        },
      },
    },
  });

  return sessions.map((session) => {
    const evaluations = session.mentorEvaluations;
    const hasEnoughResponses =
      evaluations.length >= MINIMUM_ANONYMOUS_RESPONSES;
    if (!hasEnoughResponses) {
      return {
        session: { date: session.date, topic: session.topic },
        hasEnoughResponses: false,
        stats: null,
        feedback: null,
      };
    }

    const avg = (
      field: (evaluation: (typeof evaluations)[number]) => number | null
    ) => {
      const ratings = evaluations
        .map(field)
        .filter((rating): rating is number => rating !== null);
      return ratings.length > 0
        ? Math.round(
            (ratings.reduce((total, rating) => total + rating, 0) /
              ratings.length) *
              10
          ) / 10
        : null;
    };
    const comments = evaluations
      .map((evaluation) => evaluation.comment?.trim())
      .filter((comment): comment is string => !!comment);

    return {
      session: { date: session.date, topic: session.topic },
      hasEnoughResponses: true,
      stats: {
        totalEvaluations: evaluations.length,
        averageOverall: avg((evaluation) => evaluation.overallRating),
        averageCommunication: avg(
          (evaluation) => evaluation.communicationRating
        ),
        averageHelpfulness: avg((evaluation) => evaluation.helpfulnessRating),
        averageSessionQuality: avg(
          (evaluation) => evaluation.sessionQualityRating
        ),
      },
      feedback:
        comments.length >= MINIMUM_ANONYMOUS_RESPONSES ? comments : null,
    };
  });
}

/**
 * List completed sessions for the logged-in student's batches, with each
 * assigned mentor annotated by that student's own submission status.
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
      sessionMentors: {
        select: {
          mentorId: true,
          mentor: {
            select: {
              user: { select: { universityIdNumber: true } },
            },
          },
        },
      },
    },
  });

  // Only per-session mentor identifiers are used to mark the student's own submissions.
  const existingEvals = await prisma.mentorEvaluation.findMany({
    where: { studentId: actor.sub },
    select: { sessionId: true, mentorId: true },
  });
  const evaluatedPairs = new Set(
    existingEvals.map((evaluation) => `${evaluation.sessionId}:${evaluation.mentorId}`)
  );

  return sessions.map(({ sessionMentors, ...session }) => ({
    ...session,
    mentors: sessionMentors.map((assignment) => ({
      id: assignment.mentorId,
      universityIdNumber: assignment.mentor.user.universityIdNumber,
      hasEvaluated: evaluatedPairs.has(`${session.id}:${assignment.mentorId}`),
    })),
  }));
}
