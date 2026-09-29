import type { NextResponse } from "next/server";
import { REFRESH_TOKEN_MAX_AGE_SECONDS } from "./jwt";

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Attaches the access + refresh token cookies to a response.
 * Both are HTTP-only so client-side JS (and therefore an XSS payload)
 * can never read them. `secure` is enabled outside local dev.
 */
export function attachAuthCookies(
  response: NextResponse,
  opts: { accessToken: string; refreshToken: string; rememberMe: boolean }
): void {
  const refreshMaxAge = opts.rememberMe
    ? REFRESH_TOKEN_MAX_AGE_SECONDS.rememberMe
    : REFRESH_TOKEN_MAX_AGE_SECONDS.default;

  response.cookies.set(ACCESS_TOKEN_COOKIE, opts.accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60, // matches ACCESS_TOKEN_TTL
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, opts.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: refreshMaxAge,
  });
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
