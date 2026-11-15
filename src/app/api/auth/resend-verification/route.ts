import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateRawToken,
  getVerificationResendRetryAfter,
  hashToken,
  verificationTokenExpiry,
} from "@/lib/auth/tokens";
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
    return NextResponse.json({ error: "Enter your Student ID or email." }, { status: 400 });
  }

  const identifier = parsed.data.identifier.trim();
  if (!identifier) {
    return NextResponse.json({ error: "Enter your Student ID or email." }, { status: 400 });
  }

  const ipRetryAfter = await consumeRateLimit(
    "verification-resend:ip",
    getClientIp(request),
    10,
    15 * 60 * 1000
  );
  if (ipRetryAfter) return rateLimitResponse(ipRetryAfter);

  const accountRetryAfter = await consumeRateLimit(
    "verification-resend:account",
    identifier.toLowerCase(),
    3,
    60 * 60 * 1000
  );
  if (accountRetryAfter) return rateLimitResponse(accountRetryAfter);

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { universityIdNumber: identifier },
        { email: identifier.toLowerCase() },
      ],
    },
    select: { id: true },
  });

  if (!user) return genericResponse();

  const rawToken = generateRawToken();
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${user.id} FOR UPDATE`;

    const currentUser = await tx.user.findUnique({
      where: { id: user.id },
      include: { university: true },
    });
    if (
      !currentUser ||
      currentUser.role !== "STUDENT" ||
      !currentUser.isRegistered ||
      currentUser.status !== "PENDING_VERIFICATION" ||
      currentUser.emailVerifiedAt !== null
    ) {
      return { kind: "ineligible" as const };
    }

    const latestToken = await tx.emailVerificationToken.findFirst({
      where: { userId: currentUser.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const retryAfter = getVerificationResendRetryAfter(latestToken?.createdAt ?? null);
    if (retryAfter !== null) return { kind: "cooldown" as const, retryAfter };

    await tx.emailVerificationToken.deleteMany({
      where: { userId: currentUser.id, usedAt: null },
    });
    const token = await tx.emailVerificationToken.create({
      data: {
        userId: currentUser.id,
        tokenHash: hashToken(rawToken),
        expiresAt: verificationTokenExpiry(),
      },
    });

    return {
      kind: "ready" as const,
      tokenId: token.id,
      user: currentUser,
    };
  });

  if (result.kind === "ineligible") return genericResponse();
  if (result.kind === "cooldown") {
    const minutes = Math.floor(result.retryAfter / 60);
    const seconds = result.retryAfter % 60;
    const wait = [
      minutes > 0 ? `${minutes} minute${minutes === 1 ? "" : "s"}` : "",
      seconds > 0 ? `${seconds} second${seconds === 1 ? "" : "s"}` : "",
    ]
      .filter(Boolean)
      .join(" and ");
    const response = NextResponse.json(
      { error: `Please wait ${wait} before requesting another verification email.` },
      { status: 429 }
    );
    response.headers.set("Retry-After", String(result.retryAfter));
    return response;
  }

  const { subject, html, text } = await renderEmailTemplate("EMAIL_VERIFICATION", {
    name: result.user.name ?? result.user.universityIdNumber,
    universityName: result.user.university.name,
    verificationUrl: getAppUrl(`/verify-email/${rawToken}`),
  });
  const emailResult = await sendEmail({
    to: result.user.email,
    subject,
    html,
    text,
  });

  await prisma.emailLog.create({
    data: {
      recipient: result.user.email,
      type: "EMAIL_VERIFICATION",
      status: emailResult.success ? "SENT" : "FAILED",
      error: emailResult.error,
      sentAt: emailResult.success ? new Date() : undefined,
    },
  });

  if (!emailResult.success) {
    await prisma.emailVerificationToken.deleteMany({
      where: { id: result.tokenId, usedAt: null },
    });
    return NextResponse.json(
      { error: "We could not deliver the verification email. Please try again later." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    message: "A new verification link has been sent to your registered email address.",
  });
}

function genericResponse() {
  return NextResponse.json({
    message: "If an unverified student account matches that information, a verification email will be sent.",
  });
}
