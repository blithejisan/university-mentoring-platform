import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { getCurrentUser } from "./session";
import type { AccessTokenPayload } from "./jwt";

export class AuthError extends Error {
  constructor(
    message: string,
    public status: 400 | 401 | 403 | 404 | 409
  ) {
    super(message);
  }
}

/**
 * Route-handler guard: verifies the caller is authenticated and (if
 * roles is given) holds one of the allowed roles. Every mentor-scoped
 * route additionally checks mentorProfile.approvalStatus === "APPROVED"
 * (see requireApprovedMentor) — being authenticated as MENTOR is not
 * enough on its own, per the locked mentor-approval workflow.
 *
 * This is the ONE place role checks happen for API routes — handlers
 * call this instead of re-implementing cookie/JWT logic, so there is a
 * single audited chokepoint rather than per-route ad hoc checks.
 */
export async function requireUser(
  roles?: Role[]
): Promise<AccessTokenPayload> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("Not authenticated.", 401);
  }
  if (roles && !roles.includes(user.role)) {
    throw new AuthError("Not authorized for this action.", 403);
  }
  return user;
}

/** Converts an AuthError into the right JSON response for a route handler. */
export function authErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

import { prisma } from "@/lib/prisma";

export async function requireApprovedMentor(actor: AccessTokenPayload): Promise<void> {
  if (actor.role !== "MENTOR") {
    throw new AuthError("Only mentors can perform this action.", 403);
  }
  const mentor = await prisma.mentorProfile.findUnique({
    where: { userId: actor.sub },
  });
  if (!mentor || mentor.approvalStatus !== "APPROVED") {
    throw new AuthError("Your mentor account is pending approval or has been rejected.", 403);
  }
}

export async function requireModeratorOwnsDepartment(
  actor: AccessTokenPayload,
  departmentId: string
): Promise<void> {
  if (actor.role === "ADMIN") return;
  if (actor.role !== "MODERATOR") {
    throw new AuthError("Not authorized to manage department resources.", 403);
  }
  const moderator = await prisma.moderatorProfile.findUnique({
    where: { userId: actor.sub },
  });
  if (!moderator || moderator.departmentId !== departmentId) {
    throw new AuthError("Not authorized to manage batches outside your department.", 403);
  }
}

export async function requireMentorOwnsBatch(
  actor: AccessTokenPayload,
  batchId: string
): Promise<void> {
  if (actor.role === "ADMIN") return;

  if (actor.role === "MODERATOR") {
    const batch = await prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch) throw new AuthError("Batch not found.", 403);
    await requireModeratorOwnsDepartment(actor, batch.departmentId);
    return;
  }

  if (actor.role === "MENTOR") {
    await requireApprovedMentor(actor);
    const assignment = await prisma.mentorBatch.findUnique({
      where: { mentorId_batchId: { mentorId: actor.sub, batchId } },
      include: { batch: { select: { departmentId: true } } },
    });
    if (!assignment) {
      throw new AuthError("You are not assigned to this batch.", 403);
    }
    const mentor = await prisma.mentorProfile.findUnique({
      where: { userId: actor.sub },
      select: { departmentId: true },
    });
    if (!mentor || mentor.departmentId !== assignment.batch.departmentId) {
      throw new AuthError("You are not authorized to access batches outside your department.", 403);
    }
    return;
  }

  throw new AuthError("Not authorized to access this batch.", 403);
}

export async function requireStudentIsSelf(
  actor: AccessTokenPayload,
  targetStudentUserId: string
): Promise<void> {
  if (actor.role === "ADMIN") return;
  if (actor.role === "STUDENT") {
    if (actor.sub !== targetStudentUserId) {
      throw new AuthError("Not authorized to access another student's information.", 403);
    }
    return;
  }
  if (actor.role === "MODERATOR") {
    const student = await prisma.studentProfile.findUnique({ where: { userId: targetStudentUserId } });
    if (!student) throw new AuthError("Student not found.", 403);
    await requireModeratorOwnsDepartment(actor, student.departmentId);
    return;
  }
  if (actor.role === "MENTOR") {
    await requireApprovedMentor(actor);
    // Mentor can access if student is in any batch assigned to mentor
    const mentorBatches = await prisma.mentorBatch.findMany({
      where: { mentorId: actor.sub },
      select: { batchId: true },
    });
    const batchIds = mentorBatches.map((b) => b.batchId);
    const sharedBatch = await prisma.studentBatch.findFirst({
      where: {
        studentId: targetStudentUserId,
        batchId: { in: batchIds },
        leftAt: null,
      },
    });
    if (!sharedBatch) {
      throw new AuthError("Not authorized to view student outside your assigned batches.", 403);
    }
    return;
  }
}

