import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { listPendingMentors } from "@/lib/services/mentorApproval";

export async function GET() {
  try {
    const actor = await requireUser(["ADMIN", "MODERATOR"]);
    const mentors = await listPendingMentors(actor);
    return NextResponse.json({ mentors });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
