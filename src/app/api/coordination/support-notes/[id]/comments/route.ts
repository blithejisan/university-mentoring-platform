import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth/guards";
import {
  createCoordinationComment,
  listCoordinationComments,
} from "@/lib/services/coordination";
import { createCoordinationCommentSchema } from "@/lib/validation/coordination";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await requireUser(["MENTOR", "MODERATOR"]);
    const { id } = await params;
    const comments = await listCoordinationComments(actor, id);
    return NextResponse.json({ comments });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await requireUser(["MENTOR", "MODERATOR"]);
    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = createCoordinationCommentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", details: parsed.error.issues },
        { status: 400 }
      );
    }
    const comment = await createCoordinationComment(actor, id, parsed.data.content);
    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
