import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { listCRApplications, updateCRApplication } from "@/lib/services/cr";
import { updateCRApplicationSchema } from "@/lib/validation/cr";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser(["ADMIN"]);
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    const result = await listCRApplications(actor, query);
    return NextResponse.json(result);
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireUser(["ADMIN"]);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = updateCRApplicationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await updateCRApplication(actor, parsed.data);
    return NextResponse.json({ user: result });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
