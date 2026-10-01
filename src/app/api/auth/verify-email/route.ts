import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth/tokens";
import { verifyEmailSchema } from "@/lib/validation/auth";
import { consumeRateLimit, getClientIp, rateLimitResponse } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = verifyEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A verification token is required." }, { status: 400 });
  }

  const retryAfter = await consumeRateLimit(
    "email-verification:ip",
    getClientIp(request),
    30,
    15 * 60 * 1000
  );
  if (retryAfter) return rateLimitResponse(retryAfter);

  const tokenHash = hashToken(parsed.data.token);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { mentorProfile: true } } },
  });

  if (!record) {
    return NextResponse.json({ error: "Invalid verification link." }, { status: 400 });
  }
  if (record.usedAt) {
    return NextResponse.json(
      { error: "This verification link has already been used." },
      { status: 400 }
    );
  }
  if (record.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "This verification link has expired. Please request a new one." },
      { status: 400 }
    );
  }

  const isMentor = record.user.role === "MENTOR";

  const now = new Date();
  const claimed = await prisma.$transaction(async (tx) => {
    const result = await tx.emailVerificationToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (result.count !== 1) return false;

    await tx.user.update({
      where: { id: record.userId },
      data: {
        emailVerifiedAt: now,
        // Students become immediately active. Mentors move into the
        // approval queue and cannot reach mentor-scoped routes until an
        // admin/department moderator approves them.
        status: isMentor ? "PENDING_APPROVAL" : "ACTIVE",
      },
    });
    return true;
  });

  if (!claimed) {
    return NextResponse.json(
      { error: "This verification link is invalid, expired, or already used." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    message: isMentor
      ? "Email verified. Your mentor account is now awaiting admin/moderator approval."
      : "Email verified. You can now log in.",
    status: isMentor ? "PENDING_APPROVAL" : "ACTIVE",
  });
}
