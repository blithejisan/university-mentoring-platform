import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth/guards";
import { getIdentifiedStudent } from "@/lib/services/studentDirectory";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const actor = await requireUser(["ADMIN", "MODERATOR", "MENTOR"]);
    const { studentId } = await params;
    const student = await getIdentifiedStudent(actor, studentId);
    return NextResponse.json({ student });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
