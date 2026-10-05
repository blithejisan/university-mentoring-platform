export function getAppUrl(path: string): string {
  const appBase =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  if (!appBase) {
    throw new Error("Set APP_URL or NEXT_PUBLIC_APP_URL to construct an absolute application URL.");
  }
  const relativePath = path.replace(/^\/+/, "");
  return new URL(relativePath, `${appBase.replace(/\/+$/, "")}/`).toString();
}