import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { attachAuthCookies } from "@/lib/auth/cookies";
import { loginSchema } from "@/lib/validation/auth";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your ID and password." }, { status: 400 });
  }
  const { universityIdNumber, password, rememberMe } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { universityIdNumber },
    include: { mentorProfile: true },
  });

  // Same generic error whether the ID doesn't exist or the password is
  // wrong — don't let login responses be used to enumerate valid IDs.
  const genericError = NextResponse.json(
    { error: "Incorrect ID or password." },
    { status: 401 }
  );

  if (!user) return genericError;

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) return genericError;

  if (user.status === "PENDING_VERIFICATION") {
    return NextResponse.json(
      { error: "Please verify your email before logging in." },
      { status: 403 }
    );
  }
  if (user.status === "SUSPENDED") {
    return NextResponse.json(
      { error: "This account has been suspended. Contact an administrator." },
      { status: 403 }
    );
  }
  if (user.status === "REJECTED") {
    return NextResponse.json(
      {
        error: "This mentor application was rejected.",
        reason: user.mentorProfile?.rejectionReason ?? undefined,
      },
      { status: 403 }
    );
  }

  // PENDING_APPROVAL mentors ARE allowed to log in — they just land on
  // /pending-approval instead of the mentor dashboard, so the frontend
  // needs the status to route them correctly. Mentor-scoped API routes
  // separately re-check approvalStatus === "APPROVED" (see guards.ts).

  const accessToken = signAccessToken({ sub: user.id, role: user.role, status: user.status });
  const refreshToken = signRefreshToken({ sub: user.id }, rememberMe);

  const response = NextResponse.json({
    user: {
      id: user.id,
      role: user.role,
      status: user.status,
      universityIdNumber: user.universityIdNumber,
    },
  });
  attachAuthCookies(response, { accessToken, refreshToken, rememberMe });
  return response;
}
