import { after, NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { listBatchNotices, createBatchNotice } from "@/lib/services/batchNotice";
import { createBatchNoticeSchema } from "@/lib/validation/batch-notice";
import { sendBatchNoticeEmails } from "@/lib/email/batch-notice";
import { dispatchBatchNoticeNotifications } from "@/lib/services/batchNotice";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser(["ADMIN", "STUDENT", "MENTOR"]);
    const batchId = new URL(request.url).searchParams.get("batchId") ?? undefined;
    const result = await listBatchNotices(actor, batchId);
    return NextResponse.json(result);
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireUser(["STUDENT", "MENTOR"]);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = createBatchNoticeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const notice = await createBatchNotice(actor, parsed.data);
    after(async () => {
      try {
        await dispatchBatchNoticeNotifications(notice.id);
      } catch (error) {
        console.error(`[batch-notice-notification] Failed to process notice ${notice.id}.`, error);
      }
      if (notice.sendEmailNotification) {
        try {
          await sendBatchNoticeEmails(notice.id);
        } catch (error) {
          console.error(`[batch-notice-email] Failed to process notice ${notice.id}.`, error);
        }
      }
    });
    return NextResponse.json({ notice }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
