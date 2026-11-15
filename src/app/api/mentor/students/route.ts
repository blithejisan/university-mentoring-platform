import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth/guards";
import { listMentorActiveStudents } from "@/lib/services/studentDirectory";

export async function GET() {
  try {
    const actor = await requireUser(["MENTOR"]);
    const students = await listMentorActiveStudents(actor);
    return NextResponse.json({ students });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
