import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { dispatchDueNoticeNotifications } from "@/lib/services/notice";
import { dispatchSessionReminders } from "@/lib/services/session";
import { consumeRateLimit, getClientIp, rateLimitResponse } from "@/lib/security/rate-limit";

export function isCommunicationCronAuthorized(
  request: NextRequest,
  secret = process.env.COMMUNICATION_CRON_SECRET
) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!secret || !authorization.startsWith("Bearer ")) return false;
  const provided = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function POST(request: NextRequest) {
  if (!process.env.COMMUNICATION_CRON_SECRET) {
    return NextResponse.json({ error: "Communication scheduler is not configured." }, { status: 503 });
  }
  const retryAfter = await consumeRateLimit(
    "communication-cron:ip",
    getClientIp(request),
    20,
    60 * 1000
  );
  if (retryAfter) return rateLimitResponse(retryAfter);
  if (!isCommunicationCronAuthorized(request)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  try {
    const now = new Date();
    await Promise.all([dispatchSessionReminders(now), dispatchDueNoticeNotifications(now)]);
    return NextResponse.json({ success: true, ranAt: now.toISOString() });
  } catch {
    return NextResponse.json({ error: "Communication dispatch failed." }, { status: 500 });
  }
}
