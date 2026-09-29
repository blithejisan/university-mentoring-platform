import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { createNotice, listNotices } from "@/lib/services/notice";
import { createNoticeSchema, listNoticesQuerySchema } from "@/lib/validation/notice";

// GET /api/notices?batchId=&departmentId=&status=ACTIVE|ARCHIVED
export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser();
    const { searchParams } = new URL(request.url);

    const queryParsed = listNoticesQuerySchema.safeParse({
      batchId: searchParams.get("batchId") ?? undefined,
      departmentId: searchParams.get("departmentId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    if (!queryParsed.success) {
      return NextResponse.json({ error: "Invalid query parameters.", details: queryParsed.error.issues }, { status: 400 });
    }

    const notices = await listNotices(actor, queryParsed.data);
    return NextResponse.json({ notices });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

// POST /api/notices
export async function POST(request: NextRequest) {
  try {
    const actor = await requireUser(["ADMIN", "MODERATOR", "MENTOR"]);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = createNoticeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed.", details: parsed.error.issues }, { status: 400 });
    }

    const notice = await createNotice(actor, parsed.data);
    return NextResponse.json({ notice }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
