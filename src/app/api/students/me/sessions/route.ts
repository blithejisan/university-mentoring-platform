import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { listStudentSessionsWithEvaluationStatus } from "@/lib/services/evaluation";

// GET /api/students/me/sessions
// Returns all completed sessions for the logged-in student's batches,
// annotated with hasEvaluated: boolean.
export async function GET() {
  try {
    const actor = await requireUser(["STUDENT"]);
    const sessions = await listStudentSessionsWithEvaluationStatus(actor);
    return NextResponse.json({ sessions });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      NextResponse.json({ error: "Unexpected error." }, { status: 500 })
    );
  }
}
