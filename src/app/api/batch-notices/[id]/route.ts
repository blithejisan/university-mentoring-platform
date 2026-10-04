import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { deleteBatchNotice } from "@/lib/services/batchNotice";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireUser(["ADMIN"]);
    const { id } = await params;
    await deleteBatchNotice(actor, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
