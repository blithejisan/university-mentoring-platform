import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { listEvaluationsForMentor } from "@/lib/services/evaluation";

// GET /api/mentor-evaluations?mentorId=<id>
// Mentors: returns their own evaluations (mentorId param ignored).
// Admin/Moderator: must pass ?mentorId= to specify whose evaluations to view.
export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser(["MENTOR", "ADMIN", "MODERATOR"]);
    const { searchParams } = new URL(request.url);
    const mentorId = searchParams.get("mentorId") ?? undefined;

    const result = await listEvaluationsForMentor(actor, mentorId);
    return NextResponse.json(result);
  } catch (error) {
    return (
      authErrorResponse(error) ??
      NextResponse.json({ error: "Unexpected error." }, { status: 500 })
    );
  }
}
