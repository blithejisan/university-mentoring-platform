import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

interface RateLimitRow {
  count: number;
  windowStartedAt: Date;
}

export function getRateLimitRetryAfter(
  count: number,
  maximum: number,
  windowStartedAt: Date,
  windowMs: number,
  now = Date.now()
): number | null {
  if (count <= maximum) return null;
  return Math.max(1, Math.ceil((windowStartedAt.getTime() + windowMs - now) / 1000));
}

export function getClientIp(request: NextRequest): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function consumeRateLimit(
  scope: string,
  identity: string,
  maximum: number,
  windowMs: number
): Promise<number | null> {
  const key = createHash("sha256").update(`${scope}:${identity}`).digest("hex");

  await prisma.$executeRaw`
    DELETE FROM "security_rate_limits"
    WHERE "window_started_at" < NOW() - INTERVAL '24 hours'
  `;

  const [bucket] = await prisma.$queryRaw<RateLimitRow[]>`
    INSERT INTO "security_rate_limits" ("key", "count", "window_started_at")
    VALUES (${key}, 1, NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "security_rate_limits"."window_started_at" <= NOW() - (${windowMs} * INTERVAL '1 millisecond')
          THEN 1
        ELSE "security_rate_limits"."count" + 1
      END,
      "window_started_at" = CASE
        WHEN "security_rate_limits"."window_started_at" <= NOW() - (${windowMs} * INTERVAL '1 millisecond')
          THEN NOW()
        ELSE "security_rate_limits"."window_started_at"
      END
    RETURNING "count", "window_started_at" AS "windowStartedAt"
  `;

  return getRateLimitRetryAfter(
    bucket.count,
    maximum,
    bucket.windowStartedAt,
    windowMs
  );
}

export function rateLimitResponse(retryAfterSeconds: number): NextResponse {
  const response = NextResponse.json(
    { error: "Too many requests. Please try again later." },
    { status: 429 }
  );
  response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}
