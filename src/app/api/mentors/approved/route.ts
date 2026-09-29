import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse, requireModeratorOwnsDepartment, requireApprovedMentor } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser(["ADMIN", "MODERATOR", "MENTOR"]);
    const { searchParams } = new URL(request.url);
    const requestedDepartmentId = searchParams.get("departmentId") ?? undefined;
    let filterDepartmentId: string | undefined;

    if (actor.role === "ADMIN") {
      filterDepartmentId = requestedDepartmentId;
    } else if (actor.role === "MODERATOR") {
      const moderator = await prisma.moderatorProfile.findUnique({ where: { userId: actor.sub } });
      if (!moderator) return NextResponse.json({ error: "Moderator profile not found." }, { status: 403 });
      if (requestedDepartmentId) await requireModeratorOwnsDepartment(actor, requestedDepartmentId);
      filterDepartmentId = moderator.departmentId;
    } else {
      await requireApprovedMentor(actor);
      const mentor = await prisma.mentorProfile.findUnique({ where: { userId: actor.sub } });
      if (!mentor) return NextResponse.json({ error: "Mentor profile not found." }, { status: 403 });
      filterDepartmentId = mentor.departmentId;
    }

    const mentors = await prisma.mentorProfile.findMany({
      where: {
        approvalStatus: "APPROVED",
        ...(filterDepartmentId ? { departmentId: filterDepartmentId } : {}),
      },
      select: {
        user: { select: { id: true, name: true, universityIdNumber: true, email: true } },
        department: { select: { name: true, code: true } },
      },
      orderBy: { user: { name: "asc" } },
    });

    return NextResponse.json({ mentors });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
