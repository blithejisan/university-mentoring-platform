import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { listApprovedMentors } from "@/lib/services/mentorDirectory";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser(["ADMIN", "MODERATOR", "MENTOR"]);
    const { searchParams } = new URL(request.url);
    const requestedDepartmentId = searchParams.get("departmentId") ?? undefined;
    const mentors = await listApprovedMentors(actor, requestedDepartmentId);
    return NextResponse.json({ mentors });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
