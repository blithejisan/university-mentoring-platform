import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { assignMentorToBatch, removeMentorFromBatch } from "@/lib/services/batch";
import { assignMentorSchema } from "@/lib/validation/batch";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireUser(["ADMIN", "MODERATOR"]);
    const { id: batchId } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = assignMentorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed.", details: parsed.error.issues }, { status: 400 });
    }

    const assignment = await assignMentorToBatch(actor, batchId, parsed.data.mentorUserId);
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireUser(["ADMIN", "MODERATOR"]);
    const { id: batchId } = await params;
    const { searchParams } = new URL(request.url);
    const mentorUserId = searchParams.get("mentorUserId");

    if (!mentorUserId) {
      return NextResponse.json({ error: "mentorUserId query parameter is required." }, { status: 400 });
    }

    const result = await removeMentorFromBatch(actor, batchId, mentorUserId);
    return NextResponse.json({ assignment: result });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
