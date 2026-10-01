import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";

// Access tokens are short-lived and read on every request to authorize
// an action. Refresh tokens live in an HTTP-only cookie and are only
// used to mint new access tokens — neither is ever stored client-side
// in localStorage.
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_DEFAULT = "7d"; // normal session
const REFRESH_TOKEN_TTL_REMEMBER = "30d"; // "Remember Me" checked

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`
    );
  }
  return value;
}

export interface AccessTokenPayload {
  sub: string; // user id
  role: Role;
  status: string; // AccountStatus at time of issue
  tokenVersion?: number;
}

export interface RefreshTokenPayload {
  sub: string; // user id
  tokenVersion?: number;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, requireEnv("JWT_ACCESS_SECRET"), {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, requireEnv("JWT_ACCESS_SECRET")) as AccessTokenPayload;
}

export function signRefreshToken(
  payload: RefreshTokenPayload,
  rememberMe: boolean
): string {
  return jwt.sign(payload, requireEnv("JWT_REFRESH_SECRET"), {
    expiresIn: rememberMe ? REFRESH_TOKEN_TTL_REMEMBER : REFRESH_TOKEN_TTL_DEFAULT,
  });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, requireEnv("JWT_REFRESH_SECRET")) as RefreshTokenPayload;
}

export const REFRESH_TOKEN_MAX_AGE_SECONDS = {
  default: 7 * 24 * 60 * 60,
  rememberMe: 30 * 24 * 60 * 60,
};
