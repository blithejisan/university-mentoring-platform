import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireUser } from "@/lib/auth/guards";
import { searchIdentifiedStudents } from "@/lib/services/studentDirectory";

const searchQuerySchema = z.string().trim().min(2).max(100);

export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser(["ADMIN", "MODERATOR", "MENTOR"]);
    const parsedQuery = searchQuerySchema.safeParse(
      new URL(request.url).searchParams.get("q") ?? ""
    );
    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: "Enter at least 2 characters to search." },
        { status: 400 }
      );
    }

    const students = await searchIdentifiedStudents(actor, parsedQuery.data);
    return NextResponse.json({ students });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
