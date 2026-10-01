import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateRawToken, hashToken, resetTokenExpiry } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email/sender";
import { renderEmailTemplate } from "@/lib/email/templates";
import { getAppUrl } from "@/lib/app-url";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { consumeRateLimit, getClientIp, rateLimitResponse } from "@/lib/security/rate-limit";

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
  const ipRetryAfter = await consumeRateLimit(
    "forgot-password:ip",
    getClientIp(request),
    10,
    15 * 60 * 1000
  );
  if (ipRetryAfter) return rateLimitResponse(ipRetryAfter);

  const accountRetryAfter = await consumeRateLimit(
    "forgot-password:account",
    identifier.trim().toLowerCase(),
    3,
    60 * 60 * 1000
  );
  if (accountRetryAfter) return rateLimitResponse(accountRetryAfter);

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

  const { subject, html, text } = await renderEmailTemplate("PASSWORD_RESET", {
    name: user.name ?? user.universityIdNumber,
    universityName: user.university.name,
    resetUrl: getAppUrl(`/reset-password/${rawToken}`),
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
