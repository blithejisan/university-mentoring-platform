import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { getNotificationPreferences, updateNotificationPreferences } from "@/lib/services/notification";

const preferencesSchema = z.object({
  inAppNotices: z.boolean().optional(),
  emailNotices: z.boolean().optional(),
  inAppSessions: z.boolean().optional(),
  emailSessionReminders: z.boolean().optional(),
  inAppRemarks: z.boolean().optional(),
  emailRemarks: z.boolean().optional(),
}).strict();

export async function GET() {
  try {
    const actor = await requireUser();
    const preferences = await getNotificationPreferences(actor.sub);
    return NextResponse.json({ preferences });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireUser();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const parsed = preferencesSchema.safeParse(body);
    if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
      return NextResponse.json({ error: "Provide at least one valid preference." }, { status: 400 });
    }
    const preferences = await updateNotificationPreferences(actor.sub, parsed.data);
    return NextResponse.json({ preferences });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
