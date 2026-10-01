const INTERNAL_ORIGIN = "https://internal.invalid";

export function getSafeRedirectPath(candidate: string | null): string | null {
  if (!candidate?.startsWith("/") || candidate.startsWith("//")) return null;

  try {
    const url = new URL(candidate, INTERNAL_ORIGIN);
    if (url.origin !== INTERNAL_ORIGIN || url.pathname === "/login") return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
