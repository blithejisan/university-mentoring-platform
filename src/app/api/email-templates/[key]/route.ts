import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import type { EmailTemplateKey } from "@/lib/email/templates";
import { prisma } from "@/lib/prisma";

const allowedKeys = new Set<EmailTemplateKey>(["NOTICE", "REMARK", "SESSION_REMINDER"]);
const templateSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(5000),
}).strict();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const actor = await requireUser(["ADMIN"]);
    const { key } = await params;
    if (!allowedKeys.has(key as EmailTemplateKey)) {
      return NextResponse.json({ error: "Template is not configurable." }, { status: 404 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const parsed = templateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed.", details: parsed.error.issues }, { status: 400 });

    const admin = await prisma.user.findUnique({ where: { id: actor.sub }, select: { universityId: true } });
    if (!admin) return NextResponse.json({ error: "Admin account not found." }, { status: 404 });
    const templateKey = `${admin.universityId}:${key}`;
    const template = await prisma.emailTemplate.upsert({
      where: { key: templateKey },
      create: { key: templateKey, ...parsed.data },
      update: parsed.data,
    });
    return NextResponse.json({ template: { ...template, key } });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
