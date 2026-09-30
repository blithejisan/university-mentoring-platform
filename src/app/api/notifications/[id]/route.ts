import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { setNotificationReadState } from "@/lib/services/notification";

const readStateSchema = z.object({ read: z.boolean() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireUser();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const parsed = readStateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed.", details: parsed.error.issues }, { status: 400 });
    }
    const { id } = await params;
    await setNotificationReadState(actor, id, parsed.data.read);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
