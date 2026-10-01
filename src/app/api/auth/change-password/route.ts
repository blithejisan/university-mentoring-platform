import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { authErrorResponse, requireUser } from "@/lib/auth/guards";
import { changePasswordSchema } from "@/lib/validation/auth";
import { consumeRateLimit, getClientIp, rateLimitResponse } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const actor = await requireUser();

    const ipRetryAfter = await consumeRateLimit(
      "password-change:ip",
      getClientIp(request),
      20,
      15 * 60 * 1000
    );
    if (ipRetryAfter) return rateLimitResponse(ipRetryAfter);

    const accountRetryAfter = await consumeRateLimit(
      "password-change:account",
      actor.sub,
      5,
      15 * 60 * 1000
    );
    if (accountRetryAfter) return rateLimitResponse(accountRetryAfter);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Provide valid password details." },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;
    const user = await prisma.user.findUnique({
      where: { id: actor.sub },
      select: { passwordHash: true, tokenVersion: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    if (user.tokenVersion !== (actor.tokenVersion ?? 0)) {
      return NextResponse.json(
        { error: "Your session has expired. Please sign in again." },
        { status: 401 }
      );
    }

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }
    if (await verifyPassword(newPassword, user.passwordHash)) {
      return NextResponse.json(
        { error: "Choose a new password that you have not used before." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(newPassword);
    const updated = await prisma.user.updateMany({
      where: {
        id: actor.sub,
        tokenVersion: actor.tokenVersion ?? 0,
        passwordHash: user.passwordHash,
      },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      return NextResponse.json(
        { error: "Your account changed during this request. Please sign in again." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      message: "Password updated. Please sign in again with your new password.",
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
