import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { getBatchDetails, updateBatch, archiveBatch } from "@/lib/services/batch";
import { updateBatchSchema } from "@/lib/validation/batch";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireUser(["ADMIN", "MODERATOR", "MENTOR", "STUDENT"]);
    const { id } = await params;
    const batch = await getBatchDetails(actor, id);
    return NextResponse.json({ batch });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireUser(["ADMIN", "MODERATOR", "MENTOR"]);
    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = updateBatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed.", details: parsed.error.issues }, { status: 400 });
    }

    const batch = await updateBatch(actor, id, parsed.data);
    return NextResponse.json({ batch });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireUser(["ADMIN", "MODERATOR", "MENTOR"]);
    const { id } = await params;
    const batch = await archiveBatch(actor, id);
    return NextResponse.json({ batch });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
