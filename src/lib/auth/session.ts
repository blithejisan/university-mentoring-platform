import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE } from "./cookies";
import { verifyAccessToken, type AccessTokenPayload } from "./jwt";

export function isCurrentAccountSession(
  payload: Pick<AccessTokenPayload, "tokenVersion">,
  user: { status: string; tokenVersion: number } | null
): user is { status: string; tokenVersion: number } {
  return Boolean(
    user &&
      user.status !== "SUSPENDED" &&
      user.status !== "REJECTED" &&
      (payload.tokenVersion ?? 0) === user.tokenVersion
  );
}

/**
 * Reads and verifies the access token from the incoming request's
 * cookies. Returns null if there is no token, or it is invalid/expired —
 * callers (page guards, layouts, API routes) decide what to do with that
 * (redirect to /login, call /api/auth/refresh, return 401, etc).
 *
 * This never trusts anything the client sends outside the signed,
 * HTTP-only cookie — there is no "role" query param or header shortcut.
 */
export async function getCurrentUser(): Promise<AccessTokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;

  let payload: AccessTokenPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, status: true, tokenVersion: true },
  });
  if (!isCurrentAccountSession(payload, user)) {
    return null;
  }
  return {
    sub: user.id,
    role: user.role,
    status: user.status,
    tokenVersion: user.tokenVersion,
  };
}
