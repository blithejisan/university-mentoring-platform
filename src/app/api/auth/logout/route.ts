import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
} from "@/lib/auth/cookies";
import { verifyAccessToken, verifyRefreshToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  let session: { sub: string; tokenVersion?: number } | null = null;

  if (refreshToken) {
    try {
      session = verifyRefreshToken(refreshToken);
    } catch {
      // Try the access token too, so logout revokes sessions when the refresh token is stale.
    }
  }
  if (!session && accessToken) {
    try {
      session = verifyAccessToken(accessToken);
    } catch {
      // Invalid or expired cookies still need to be cleared below.
    }
  }
  if (session) {
    await prisma.user.updateMany({
      where: { id: session.sub, tokenVersion: session.tokenVersion ?? 0 },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  const response = NextResponse.json({ message: "Logged out." });
  clearAuthCookies(response);
  return response;
}
