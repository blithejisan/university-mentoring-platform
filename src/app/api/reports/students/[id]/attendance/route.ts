import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { getStudentAttendanceSummary } from "@/lib/services/attendanceReport";
import { parseReportFilters } from "@/lib/validation/report-filters";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireUser(["ADMIN", "MODERATOR", "MENTOR", "STUDENT"]);
    const { id: studentUserId } = await params;
    const filters = parseReportFilters(request.nextUrl.searchParams);
    const summary = await getStudentAttendanceSummary(actor, studentUserId, filters);
    return NextResponse.json({ summary });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
