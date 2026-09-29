import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE } from "./cookies";
import { verifyAccessToken, type AccessTokenPayload } from "./jwt";

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

  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}
