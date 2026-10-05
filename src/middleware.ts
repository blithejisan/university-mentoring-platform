import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Middleware runs on the Edge runtime, where the `jsonwebtoken` package
// (used everywhere else in this app, via lib/auth/jwt.ts) isn't
// supported. `jose` verifies the same HS256 tokens and IS edge-safe, so
// it's used here only. This layer does coarse redirects (logged in vs
// not, and role-group routing); every actual data-access check still
// happens server-side in the route handler / page via lib/auth/guards.ts
// — middleware is a UX convenience, not the security boundary.

const PROTECTED_PREFIXES = ["/admin", "/mentor", "/moderator", "/student", "/pending-approval"];
const AUTH_ONLY_PREFIXES = ["/login", "/register", "/forgot-password"];

const ROLE_HOME: Record<string, string> = {
  ADMIN: "/admin/dashboard",
  MENTOR: "/mentor/dashboard",
  MODERATOR: "/moderator/dashboard",
  STUDENT: "/student/dashboard",
};
const MENTOR_STUDENT_PAGES = [
  "/student/my-batch",
  "/student/lab-report-generator",
];

async function readSession(request: NextRequest) {
  const token = request.cookies.get("access_token")?.value;
  if (!token) return null;
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload as { sub: string; role: string; status: string };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await readSession(request);

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthOnly = AUTH_ONLY_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtected && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isProtected && session) {
    const roleRoot = `/${pathname.split("/")[1]}`;
    const expectedRoot = ROLE_HOME[session.role]?.split("/").slice(0, 2).join("/");
    const isPendingApprovalPage = pathname.startsWith("/pending-approval");
    const isMentorStudentPage =
      session.role === "MENTOR" &&
      MENTOR_STUDENT_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));

    // A pending-approval mentor may only see /pending-approval, not the
    // mentor dashboard proper. Enforced again server-side in the mentor
    // route handlers, per the locked approval workflow.
    if (session.role === "MENTOR" && session.status === "PENDING_APPROVAL" && !isPendingApprovalPage) {
      return NextResponse.redirect(new URL("/pending-approval", request.url));
    }

    // Prevent a student from typing /admin/... into the address bar, etc.
    if (!isPendingApprovalPage && !isMentorStudentPage && expectedRoot && roleRoot !== expectedRoot) {
      return NextResponse.redirect(new URL(ROLE_HOME[session.role] ?? "/login", request.url));
    }
  }

  if (isAuthOnly && session) {
    return NextResponse.redirect(new URL(ROLE_HOME[session.role] ?? "/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/mentor/:path*",
    "/moderator/:path*",
    "/student/:path*",
    "/pending-approval",
    "/login",
    "/register",
    "/forgot-password",
  ],
};
