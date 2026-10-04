import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth/guards";
import { searchCoordinationStudents } from "@/lib/services/coordination";
import { searchCoordinationStudentsQuerySchema } from "@/lib/validation/coordination";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser(["MENTOR", "MODERATOR"]);
    const parsed = searchCoordinationStudentsQuerySchema.safeParse({
      q: new URL(request.url).searchParams.get("q") ?? "",
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid search query.", details: parsed.error.issues },
        { status: 400 }
      );
    }
    const students = await searchCoordinationStudents(actor, parsed.data.q);
    return NextResponse.json({ students });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
