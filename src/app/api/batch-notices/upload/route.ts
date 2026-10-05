import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { uploadBatchNoticeAttachment } from "@/lib/services/batchNoticeAttachment";

export const runtime = "nodejs";
const MAX_REQUEST_SIZE = 11 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const actor = await requireUser(["STUDENT"]);
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_SIZE) {
      return NextResponse.json({ error: "Attachments must be 10 MB or smaller." }, { status: 413 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "Upload must use multipart form data." }, { status: 400 });
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Select a file to upload." }, { status: 400 });
    }

    const attachment = await uploadBatchNoticeAttachment(actor, file);
    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("[batch-notice-upload] Attachment upload failed.", error);
    return NextResponse.json({ error: "Could not upload attachment." }, { status: 500 });
  }
}
