import { prisma } from "@/lib/prisma";
import {
  AuthError,
  requireApprovedMentor,
  requireModeratorOwnsDepartment,
} from "@/lib/auth/guards";
import type { AccessTokenPayload } from "@/lib/auth/jwt";

export async function listApprovedMentors(
  actor: AccessTokenPayload,
  requestedDepartmentId?: string
) {
  if (!["ADMIN", "MODERATOR", "MENTOR"].includes(actor.role)) {
    throw new AuthError("Not authorized to view mentors.", 403);
  }

  const actorUser = await prisma.user.findUnique({
    where: { id: actor.sub },
    select: { universityId: true },
  });
  if (!actorUser) {
    throw new AuthError("Not authorized to view mentors.", 403);
  }

  let filterDepartmentId: string | undefined;

  if (actor.role === "ADMIN") {
    if (requestedDepartmentId) {
      await requireModeratorOwnsDepartment(actor, requestedDepartmentId);
      filterDepartmentId = requestedDepartmentId;
    }
  } else if (actor.role === "MODERATOR") {
    const moderator = await prisma.moderatorProfile.findUnique({
      where: { userId: actor.sub },
    });
    if (!moderator) {
      throw new AuthError("Moderator profile not found.", 403);
    }
    await requireModeratorOwnsDepartment(actor, moderator.departmentId);
    if (requestedDepartmentId) {
      await requireModeratorOwnsDepartment(actor, requestedDepartmentId);
    }
    filterDepartmentId = moderator.departmentId;
  } else {
    await requireApprovedMentor(actor);
    const mentor = await prisma.mentorProfile.findUnique({
      where: { userId: actor.sub },
      select: {
        departmentId: true,
        department: { select: { universityId: true } },
      },
    });
    if (!mentor || mentor.department.universityId !== actorUser.universityId) {
      throw new AuthError("Mentor profile is outside your university.", 403);
    }
    filterDepartmentId = mentor.departmentId;
  }

  return prisma.mentorProfile.findMany({
    where: {
      approvalStatus: "APPROVED",
      department: { universityId: actorUser.universityId },
      ...(filterDepartmentId ? { departmentId: filterDepartmentId } : {}),
    },
    select: {
      userId: true,
      user: { select: { id: true, name: true, universityIdNumber: true, email: true } },
      department: { select: { name: true, code: true } },
    },
    orderBy: { user: { name: "asc" } },
  });
}
