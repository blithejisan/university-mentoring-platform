import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { REFRESH_TOKEN_COOKIE, ACCESS_TOKEN_COOKIE } from "@/lib/auth/cookies";
import { verifyRefreshToken, signAccessToken } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "No active session." }, { status: 401 });
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 });
  }

  // Re-read the user rather than trusting stale claims — role/status may
  // have changed (e.g. a mentor got approved, or an account was
  // suspended) since the refresh token was issued.
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status === "SUSPENDED" || user.status === "REJECTED") {
    return NextResponse.json({ error: "Session no longer valid." }, { status: 401 });
  }

  const accessToken = signAccessToken({ sub: user.id, role: user.role, status: user.status });

  const response = NextResponse.json({
    user: { id: user.id, role: user.role, status: user.status },
  });
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60,
  });
  return response;
}
