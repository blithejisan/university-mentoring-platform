import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { generateRawToken, hashToken, verificationTokenExpiry } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email/sender";
import { renderEmailTemplate } from "@/lib/email/templates";
import { getAppUrl } from "@/lib/app-url";
import { registerSchema } from "@/lib/validation/auth";
import { consumeRateLimit, getClientIp, rateLimitResponse } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: formatZodError(parsed.error) },
      { status: 400 }
    );
  }
  const input = parsed.data;
  const universityIdNumber = input.universityIdNumber.trim();

  const retryAfter = await consumeRateLimit(
    "registration:ip",
    getClientIp(request),
    5,
    60 * 60 * 1000
  );
  if (retryAfter) return rateLimitResponse(retryAfter);

  const department = await prisma.department.findUnique({
    where: { id: input.departmentId },
    include: { university: true },
  });
  if (!department) {
    return NextResponse.json({ error: "Selected department was not found." }, { status: 400 });
  }

  // universityIdNumber is globally unique across the whole university
  // (locked Phase 0 decision) — enforced here and by the DB constraint.
  const existing = await prisma.user.findUnique({
    where: { universityIdNumber },
    include: { studentProfile: true },
  });
  const canClaimImportedStudent = Boolean(
    input.role === "STUDENT" &&
    existing?.role === "STUDENT" &&
    !existing.isRegistered &&
    existing.status === "PENDING_VERIFICATION" &&
    existing.emailVerifiedAt === null &&
    existing.studentProfile?.departmentId === input.departmentId
  );
  if (existing && !canClaimImportedStudent) {
    return NextResponse.json(
      {
        error: existing.isRegistered
          ? "This Student/University ID has already been registered and claimed."
          : "This Student/University ID is not available for registration in the selected department.",
      },
      { status: 409 }
    );
  }

  const universityEmail = input.universityEmail ?? input.altEmail;
  const submittedEmails = [...new Set([input.email, universityEmail].filter((email): email is string => Boolean(email)))];
  const emailOwner = await prisma.user.findFirst({
    where: {
      ...(existing ? { id: { not: existing.id } } : {}),
      OR: [
        { email: { in: submittedEmails } },
        { altEmail: { in: submittedEmails } },
      ],
    },
    select: { id: true },
  });
  if (emailOwner) {
    return NextResponse.json({ error: "This email address is already registered." }, { status: 409 });
  }

  const passwordHash = await hashPassword(input.password);

  let user: User | null;
  try {
    user = await prisma.$transaction(async (tx) => {
      if (existing && canClaimImportedStudent && input.role === "STUDENT") {
        const claim = await tx.user.updateMany({
          where: {
            id: existing.id,
            isRegistered: false,
            status: "PENDING_VERIFICATION",
            emailVerifiedAt: null,
          },
          data: {
            name: input.name,
            email: input.email,
            altEmail: universityEmail ?? existing.altEmail,
            passwordHash,
            isRegistered: true,
            status: "PENDING_VERIFICATION",
            emailVerifiedAt: null,
            crStatus:
              input.applyAsCR && existing.crStatus !== "APPROVED"
                ? "PENDING"
                : undefined,
          },
        });
        if (claim.count !== 1) return null;

        await tx.emailVerificationToken.deleteMany({
          where: { userId: existing.id, usedAt: null },
        });
        await tx.studentProfile.update({
          where: { userId: existing.id },
          data: { phone: input.phone },
        });
        return tx.user.findUniqueOrThrow({
          where: { id: existing.id },
        });
      }

      const created = await tx.user.create({
        data: {
          universityId: department.universityId,
          role: input.role,
          universityIdNumber,
          name: input.name,
          email: input.email,
          altEmail: universityEmail,
          passwordHash,
          isRegistered: true,
          // Mentors additionally require admin/moderator approval after
          // verifying their email (handled in the verify-email route).
          // Students go straight to ACTIVE once verified.
          status: "PENDING_VERIFICATION",
          crStatus: input.role === "STUDENT" && input.applyAsCR ? "PENDING" : "NONE",
        },
      });

      await tx.studentProfile.create({
        data: {
          userId: created.id,
          departmentId: input.departmentId,
          phone: input.role === "STUDENT" ? input.phone : undefined,
        },
      });

      if (input.role === "MENTOR") {
        await tx.mentorProfile.create({
          data: {
            userId: created.id,
            departmentId: input.departmentId,
            approvalStatus: "PENDING_APPROVAL",
          },
        });
      }

      return created;
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "This Student/University ID or email address is already registered." },
        { status: 409 }
      );
    }
    throw error;
  }

  if (!user) {
    return NextResponse.json(
      { error: "This Student/University ID has already been registered and claimed." },
      { status: 409 }
    );
  }

  const rawToken = generateRawToken();
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: verificationTokenExpiry(),
    },
  });

  const { subject, html, text } = await renderEmailTemplate("EMAIL_VERIFICATION", {
    name: user.name ?? user.universityIdNumber,
    universityName: department.university.name,
    verificationUrl: getAppUrl(`/verify-email/${rawToken}`),
  });

  const emailResult = await sendEmail({ to: user.email, subject, html, text });
  await prisma.emailLog.create({
    data: {
      recipient: user.email,
      type: "EMAIL_VERIFICATION",
      status: emailResult.success ? "SENT" : "FAILED",
      error: emailResult.error,
      sentAt: emailResult.success ? new Date() : undefined,
    },
  });

  return NextResponse.json(
    {
      message: emailResult.success
        ? input.role === "MENTOR"
          ? "Registered. Check your personal email to verify your account, then wait for admin/moderator approval before you can log in as a mentor."
          : "Registered. Check your personal email to verify your account before logging in."
        : "Your account was registered, but the verification email could not be delivered. Check the email provider configuration before trying again.",
    },
    { status: 201 }
  );
}

function formatZodError(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}
