import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { createRemark, listRemarks } from "@/lib/services/remark";
import { createRemarkSchema, listRemarksQuerySchema } from "@/lib/validation/remark";
import type { RemarkStatus } from "@prisma/client";

// GET /api/remarks?studentId=&batchId=&status=OPEN|IN_REVIEW|RESOLVED
export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser();
    const { searchParams } = new URL(request.url);

    const queryParsed = listRemarksQuerySchema.safeParse({
      studentId: searchParams.get("studentId") ?? undefined,
      batchId: searchParams.get("batchId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    if (!queryParsed.success) {
      return NextResponse.json({ error: "Invalid query parameters.", details: queryParsed.error.issues }, { status: 400 });
    }

    const remarks = await listRemarks(actor, {
      ...queryParsed.data,
      status: queryParsed.data.status as RemarkStatus | undefined,
    });
    return NextResponse.json({ remarks });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

// POST /api/remarks — mentor creates a remark for a student
export async function POST(request: NextRequest) {
  try {
    const actor = await requireUser(["MENTOR"]);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = createRemarkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed.", details: parsed.error.issues }, { status: 400 });
    }

    const remark = await createRemark(actor, parsed.data);
    return NextResponse.json({ remark }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
