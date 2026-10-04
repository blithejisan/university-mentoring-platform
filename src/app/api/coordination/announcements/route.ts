import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth/guards";
import {
  createCoordinationAnnouncement,
  listCoordinationAnnouncements,
} from "@/lib/services/coordination";
import { createCoordinationNoticeSchema } from "@/lib/validation/coordination";

export async function GET() {
  try {
    const actor = await requireUser(["MENTOR", "MODERATOR"]);
    const announcements = await listCoordinationAnnouncements(actor);
    return NextResponse.json({ announcements });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireUser(["MODERATOR"]);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = createCoordinationNoticeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", details: parsed.error.issues },
        { status: 400 }
      );
    }
    const announcement = await createCoordinationAnnouncement(actor, parsed.data);
    return NextResponse.json({ announcement }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
