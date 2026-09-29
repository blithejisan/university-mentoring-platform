import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { listBatches, createBatch, createMentorBatch } from "@/lib/services/batch";
import { createBatchSchema, createMentorBatchSchema } from "@/lib/validation/batch";

export async function GET() {
  try {
    const actor = await requireUser(["ADMIN", "MODERATOR", "MENTOR", "STUDENT"]);
    const batches = await listBatches(actor);
    return NextResponse.json({ batches });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireUser(["ADMIN", "MODERATOR", "MENTOR"]);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (actor.role === "MENTOR") {
      const parsed = createMentorBatchSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Validation failed.", details: parsed.error.issues }, { status: 400 });
      }
      const batch = await createMentorBatch(actor, parsed.data);
      return NextResponse.json({ batch }, { status: 201 });
    }

    const parsed = createBatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed.", details: parsed.error.issues }, { status: 400 });
    }
    const batch = await createBatch(actor, parsed.data);
    return NextResponse.json({ batch }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
