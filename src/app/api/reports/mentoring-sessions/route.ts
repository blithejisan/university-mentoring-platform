import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { getSessionMonitoring } from "@/lib/services/sessionMonitoring";
import { parseReportFilters } from "@/lib/validation/report-filters";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser(["ADMIN", "MODERATOR"]);
    const filters = parseReportFilters(request.nextUrl.searchParams);
    const monitoring = await getSessionMonitoring(actor, filters);
    return NextResponse.json({ monitoring });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}