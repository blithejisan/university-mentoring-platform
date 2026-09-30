import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { listNotifications } from "@/lib/services/notification";

export async function GET() {
  try {
    const actor = await requireUser();
    return NextResponse.json(await listNotifications(actor));
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
