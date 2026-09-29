import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { getDepartmentAttendanceOverview } from "@/lib/services/attendanceReport";
import { parseReportFilters } from "@/lib/validation/report-filters";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser(["ADMIN", "MODERATOR"]);
    const filters = parseReportFilters(request.nextUrl.searchParams);
    const overview = await getDepartmentAttendanceOverview(actor, filters);
    return NextResponse.json({ overview });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
