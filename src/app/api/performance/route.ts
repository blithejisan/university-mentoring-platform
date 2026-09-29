import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { createPerformanceRecord } from "@/lib/services/performance";
import { createPerformanceSchema } from "@/lib/validation/performance";

export async function POST(request: NextRequest) {
  try {
    const actor = await requireUser(["ADMIN", "MODERATOR", "MENTOR"]);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = createPerformanceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed.", details: parsed.error.issues }, { status: 400 });
    }

    const record = await createPerformanceRecord(actor, parsed.data);
    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
