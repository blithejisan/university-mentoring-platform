import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth/guards";
import { deleteCoordinationSupportNote } from "@/lib/services/coordination";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireUser(["ADMIN", "MENTOR", "MODERATOR"]);
    const { id } = await params;
    const result = await deleteCoordinationSupportNote(actor, id);
    return NextResponse.json(result);
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
