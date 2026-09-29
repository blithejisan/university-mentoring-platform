import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { rejectMentor } from "@/lib/services/mentorApproval";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireUser(["ADMIN", "MODERATOR"]);
    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "A rejection reason is required." }, { status: 400 });
    }
    const reason = (body as { reason?: string })?.reason;
    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: "A rejection reason is required." }, { status: 400 });
    }

    const result = await rejectMentor(actor, id, reason);
    return NextResponse.json(result);
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
