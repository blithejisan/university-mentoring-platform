export function getAppUrl(path: string): string {
  const appBase = (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
  const relativePath = path.replace(/^\/+/, "");
  return new URL(relativePath, `${appBase}/`).toString();
}