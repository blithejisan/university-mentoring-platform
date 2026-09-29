import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { generateRawToken, hashToken, verificationTokenExpiry } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email/sender";
import { renderEmailTemplate } from "@/lib/email/templates";
import { registerSchema } from "@/lib/validation/auth";

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
    where: { universityIdNumber: input.universityIdNumber },
    include: { studentProfile: true },
  });
  const canCompletePrecreatedStudent = Boolean(
    input.role === "STUDENT" &&
    existing?.role === "STUDENT" &&
    existing.status === "PENDING_VERIFICATION" &&
    existing.emailVerifiedAt === null &&
    existing.email === input.email &&
    existing.studentProfile?.departmentId === input.departmentId
  );
  if (existing && !canCompletePrecreatedStudent) {
    return NextResponse.json(
      { error: "This Student/University ID is already registered." },
      { status: 409 }
    );
  }

  const existingEmail = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingEmail && existingEmail.id !== existing?.id) {
    return NextResponse.json({ error: "This email address is already registered." }, { status: 409 });
  }

  const passwordHash = await hashPassword(input.password);

  let user: User;
  try {
    user = await prisma.$transaction(async (tx) => {
      if (existing && canCompletePrecreatedStudent) {
        await tx.emailVerificationToken.deleteMany({
          where: { userId: existing.id, usedAt: null },
        });
        await tx.studentProfile.update({
          where: { userId: existing.id },
          data: { phone: input.role === "STUDENT" ? input.phone : undefined },
        });
        return tx.user.update({
          where: { id: existing.id },
          data: {
            name: input.name,
            email: input.email,
            altEmail: input.universityEmail ?? input.altEmail,
            passwordHash,
            status: "PENDING_VERIFICATION",
            emailVerifiedAt: null,
          },
        });
      }

      const created = await tx.user.create({
        data: {
          universityId: department.universityId,
          role: input.role,
          universityIdNumber: input.universityIdNumber,
          name: input.name,
          email: input.email,
          altEmail: input.universityEmail ?? input.altEmail,
          passwordHash,
          // Mentors additionally require admin/moderator approval after
          // verifying their email (handled in the verify-email route).
          // Students go straight to ACTIVE once verified.
          status: "PENDING_VERIFICATION",
        },
      });

      if (input.role === "STUDENT") {
        await tx.studentProfile.create({
          data: {
            userId: created.id,
            departmentId: input.departmentId,
            phone: input.phone,
          },
        });
      } else {
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

  const rawToken = generateRawToken();
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: verificationTokenExpiry(),
    },
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const { subject, html, text } = await renderEmailTemplate("EMAIL_VERIFICATION", {
    name: user.name ?? user.universityIdNumber,
    universityName: department.university.name,
    verificationUrl: `${appUrl}/verify-email/${rawToken}`,
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
