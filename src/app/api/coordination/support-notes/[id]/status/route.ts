import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth/guards";
import { updateCoordinationSupportStatus } from "@/lib/services/coordination";
import { updateCoordinationSupportStatusSchema } from "@/lib/validation/coordination";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireUser(["MENTOR", "MODERATOR"]);
    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = updateCoordinationSupportStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", details: parsed.error.issues },
        { status: 400 }
      );
    }
    const supportNote = await updateCoordinationSupportStatus(actor, id, parsed.data.status);
    return NextResponse.json({ supportNote });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
