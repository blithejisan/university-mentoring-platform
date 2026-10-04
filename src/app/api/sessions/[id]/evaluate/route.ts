import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import {
  submitMentorEvaluation,
  getEvaluationStatus,
} from "@/lib/services/evaluation";
import { submitEvaluationSchema } from "@/lib/validation/evaluation";

// GET /api/sessions/[id]/evaluate
// Returns whether the authenticated student has already evaluated this session.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireUser(["STUDENT"]);
    const { id } = await params;
    const mentorId = new URL(request.url).searchParams.get("mentorId") ?? undefined;
    const result = await getEvaluationStatus(actor, id, mentorId);
    return NextResponse.json(result);
  } catch (error) {
    return (
      authErrorResponse(error) ??
      NextResponse.json({ error: "Unexpected error." }, { status: 500 })
    );
  }
}

// POST /api/sessions/[id]/evaluate
// Student submits a mentor evaluation for a completed session.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireUser(["STUDENT"]);
    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const parsed = submitEvaluationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const evaluation = await submitMentorEvaluation(actor, id, parsed.data);
    return NextResponse.json({ evaluation }, { status: 201 });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      NextResponse.json({ error: "Unexpected error." }, { status: 500 })
    );
  }
}
