import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { getBatchAttendanceReport } from "@/lib/services/attendanceReport";
import { parseReportFilters } from "@/lib/validation/report-filters";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireUser(["ADMIN", "MODERATOR", "MENTOR"]);
    const { id: batchId } = await params;
    const filters = parseReportFilters(request.nextUrl.searchParams);
    const report = await getBatchAttendanceReport(actor, batchId, filters);
    return NextResponse.json({ report });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
