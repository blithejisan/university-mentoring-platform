import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth/tokens";
import { hashPassword } from "@/lib/auth/password";
import { resetPasswordSchema } from "@/lib/validation/auth";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A valid token and new password are required." },
      { status: 400 }
    );
  }

  const tokenHash = hashToken(parsed.data.token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record) {
    return NextResponse.json({ error: "Invalid reset link." }, { status: 400 });
  }
  if (record.usedAt) {
    return NextResponse.json(
      { error: "This reset link has already been used." },
      { status: 400 }
    );
  }
  if (record.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "This reset link has expired. Please request a new one." },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const now = new Date();
  const claimed = await prisma.$transaction(async (tx) => {
    const result = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (result.count !== 1) return false;

    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    });
    return true;
  });

  if (!claimed) {
    return NextResponse.json(
      { error: "This reset link is invalid, expired, or already used." },
      { status: 400 }
    );
  }

  return NextResponse.json({ message: "Password updated. You can now log in." });
}
