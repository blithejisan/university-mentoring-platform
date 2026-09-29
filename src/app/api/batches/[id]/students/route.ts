import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { addStudentById, assignStudentToBatch, importStudentsFromSpreadsheet, removeStudentFromBatch } from "@/lib/services/batch";
import { addStudentByIdSchema, assignStudentSchema, importStudentRowsSchema } from "@/lib/validation/batch";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireUser(["ADMIN", "MODERATOR", "MENTOR"]);
    const { id: batchId } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const rowsValue = Array.isArray(body)
      ? body
      : body && typeof body === "object" && Array.isArray((body as { rows?: unknown }).rows)
        ? (body as { rows: unknown[] }).rows
        : null;

    if (rowsValue) {
      const parsed = importStudentRowsSchema.safeParse(rowsValue);
      if (!parsed.success) {
        return NextResponse.json({ error: "Validation failed.", details: parsed.error.issues }, { status: 400 });
      }
      const result = await importStudentsFromSpreadsheet(actor, batchId, parsed.data);
      return NextResponse.json(result, { status: 200 });
    }

    if (actor.role === "MENTOR") {
      const parsed = addStudentByIdSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Validation failed.", details: parsed.error.issues }, { status: 400 });
      }
      const result = await addStudentById(actor, batchId, parsed.data);
      return NextResponse.json(result, { status: 201 });
    }

    const parsed = assignStudentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed.", details: parsed.error.issues }, { status: 400 });
    }

    const assignment = await assignStudentToBatch(actor, batchId, parsed.data.studentUserId);
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireUser(["ADMIN", "MODERATOR", "MENTOR"]);
    const { id: batchId } = await params;
    const { searchParams } = new URL(request.url);
    const studentUserId = searchParams.get("studentUserId");

    if (!studentUserId) {
      return NextResponse.json({ error: "studentUserId query parameter is required." }, { status: 400 });
    }

    const result = await removeStudentFromBatch(actor, batchId, studentUserId);
    return NextResponse.json({ assignment: result });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
