import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guards";
import { DEFAULT_TEMPLATES } from "@/lib/email/templates";
import type { EmailTemplateKey } from "@/lib/email/templates";
import { prisma } from "@/lib/prisma";

const PHASE_SIX_TEMPLATE_KEYS: EmailTemplateKey[] = ["NOTICE", "REMARK", "SESSION_REMINDER"];

export async function GET() {
  try {
    const actor = await requireUser(["ADMIN"]);
    const admin = await prisma.user.findUnique({ where: { id: actor.sub }, select: { universityId: true } });
    if (!admin) return NextResponse.json({ error: "Admin account not found." }, { status: 404 });

    const templates = await Promise.all(PHASE_SIX_TEMPLATE_KEYS.map(async (key) => {
      const custom = await prisma.emailTemplate.findUnique({ where: { key: `${admin.universityId}:${key}` } });
      const global = custom ? null : await prisma.emailTemplate.findUnique({ where: { key } });
      return { ...(custom ?? global ?? DEFAULT_TEMPLATES[key]), key, customized: !!custom };
    }));
    return NextResponse.json({ templates });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
