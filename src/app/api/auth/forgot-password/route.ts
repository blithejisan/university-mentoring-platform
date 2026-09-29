import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateRawToken, hashToken, resetTokenExpiry } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email/sender";
import { renderEmailTemplate } from "@/lib/email/templates";
import { forgotPasswordSchema } from "@/lib/validation/auth";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your ID or email." }, { status: 400 });
  }

  const { identifier } = parsed.data;
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ universityIdNumber: identifier }, { email: identifier }],
    },
    include: { university: true },
  });

  // Always return the same generic message whether or not the account
  // exists, so this endpoint can't be used to enumerate registered IDs.
  const genericResponse = NextResponse.json({
    message: "If that account exists, a password reset link has been sent to its email.",
  });

  if (!user) return genericResponse;

  const rawToken = generateRawToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: resetTokenExpiry(),
    },
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const { subject, html, text } = await renderEmailTemplate("PASSWORD_RESET", {
    name: user.name ?? user.universityIdNumber,
    universityName: user.university.name,
    resetUrl: `${appUrl}/reset-password/${rawToken}`,
  });

  const emailResult = await sendEmail({ to: user.email, subject, html, text });
  await prisma.emailLog.create({
    data: {
      recipient: user.email,
      type: "PASSWORD_RESET",
      status: emailResult.success ? "SENT" : "FAILED",
      error: emailResult.error,
      sentAt: emailResult.success ? new Date() : undefined,
    },
  });

  return genericResponse;
}
