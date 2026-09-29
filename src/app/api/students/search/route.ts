import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { searchStudents } from "@/lib/services/batch";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser(["ADMIN", "MODERATOR", "MENTOR"]);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";

    const students = await searchStudents(actor, q);
    return NextResponse.json({ students });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
