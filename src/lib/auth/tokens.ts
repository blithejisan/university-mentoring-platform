import crypto from "crypto";

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes, per locked Phase 0 design

/**
 * Generates a random token for email verification / password reset links.
 * Only the SHA-256 hash of the token is stored in the database — the raw
 * token exists only in the emailed link, so a database read alone can
 * never be used to reset someone's password or verify their email.
 */
export function generateRawToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function verificationTokenExpiry(): Date {
  return new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
}

export function resetTokenExpiry(): Date {
  return new Date(Date.now() + RESET_TOKEN_TTL_MS);
}
