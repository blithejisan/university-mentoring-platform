import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { getNotice, updateNotice, archiveNotice } from "@/lib/services/notice";
import { updateNoticeSchema } from "@/lib/validation/notice";

// GET /api/notices/[id]
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireUser();
    const { id } = await params;
    const notice = await getNotice(actor, id);
    return NextResponse.json({ notice });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

// PATCH /api/notices/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireUser(["ADMIN", "MODERATOR", "MENTOR"]);
    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = updateNoticeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed.", details: parsed.error.issues }, { status: 400 });
    }

    const notice = await updateNotice(actor, id, parsed.data);
    return NextResponse.json({ notice });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

// DELETE /api/notices/[id] — archives the notice (soft delete)
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireUser(["ADMIN", "MODERATOR", "MENTOR"]);
    const { id } = await params;
    const notice = await archiveNotice(actor, id);
    return NextResponse.json({ notice });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
