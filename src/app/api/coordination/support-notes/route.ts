import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth/guards";
import {
  createCoordinationSupportNote,
  listCoordinationSupportNotes,
} from "@/lib/services/coordination";
import { createCoordinationSupportNoteSchema } from "@/lib/validation/coordination";

export async function GET() {
  try {
    const actor = await requireUser(["MENTOR", "MODERATOR"]);
    const result = await listCoordinationSupportNotes(actor);
    return NextResponse.json(result);
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireUser(["MENTOR", "MODERATOR"]);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = createCoordinationSupportNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", details: parsed.error.issues },
        { status: 400 }
      );
    }
    const supportNote = await createCoordinationSupportNote(actor, parsed.data);
    return NextResponse.json({ supportNote }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
