import 'dotenv/config';
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const university = await prisma.university.upsert({
    where: { id: "green-university" },
    update: {},
    create: { id: "green-university", name: "Green University of Bangladesh" },
  });

  const ads = await prisma.department.upsert({
    where: { universityId_code: { universityId: university.id, code: "ADS" } },
    update: {},
    create: {
      universityId: university.id,
      name: "Artificial Intelligence and Data Science",
      code: "ADS",
      lowAttendanceThreshold: 60,
    },
  });

  // Registration only ever creates STUDENT or MENTOR accounts (locked
  // Phase 0 decision) — the first ADMIN has to be seeded/created directly
  // in the database. Change this password immediately after first login.
  const adminId = process.env.SEED_ADMIN_ID ?? "admin-001";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.edu";

  const existingAdmin = await prisma.user.findUnique({
    where: { universityIdNumber: adminId },
  });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        universityId: university.id,
        role: "ADMIN",
        universityIdNumber: adminId,
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`Seeded admin account: ${adminId} / ${adminPassword}`);
  } else {
    console.log(`Admin account ${adminId} already exists, skipping.`);
  }

  // Moderator accounts also aren't created via public registration —
  // seeded here (scoped to ADS) so the moderator approval workflow can
  // be exercised locally before a proper "admin manages moderators" UI
  // exists.
  const moderatorId = process.env.SEED_MODERATOR_ID ?? "moderator-001";
  const moderatorPassword = process.env.SEED_MODERATOR_PASSWORD ?? "ChangeMe123!";
  const moderatorEmail = process.env.SEED_MODERATOR_EMAIL ?? "moderator@example.edu";

  const existingModerator = await prisma.user.findUnique({
    where: { universityIdNumber: moderatorId },
  });

  if (!existingModerator) {
    await prisma.user.create({
      data: {
        universityId: university.id,
        role: "MODERATOR",
        universityIdNumber: moderatorId,
        email: moderatorEmail,
        passwordHash: await bcrypt.hash(moderatorPassword, 12),
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        moderatorProfile: {
          create: { departmentId: ads.id, scopeType: "DEPARTMENT" },
        },
      },
    });
    console.log(`Seeded moderator account (ADS): ${moderatorId} / ${moderatorPassword}`);
  } else {
    console.log(`Moderator account ${moderatorId} already exists, skipping.`);
  }

  await prisma.emailTemplate.upsert({
    where: { key: "EMAIL_VERIFICATION" },
    update: {},
    create: {
      key: "EMAIL_VERIFICATION",
      subject: "Verify your email address",
      body:
        "Hi {{name}},\n\nThank you for registering with the Mentor & Student Management Platform.\n\nPlease verify your email address to complete your registration and continue using the platform.\n\nThis verification link will expire in 24 hours.\n\n{{verificationUrl}}\n\nIf you did not create this account, you can ignore this email.",
    },
  });

  await prisma.emailTemplate.upsert({
    where: { key: "PASSWORD_RESET" },
    update: {},
    create: {
      key: "PASSWORD_RESET",
      subject: "Reset your {{universityName}} password",
      body:
        "Hi {{name}},\n\nWe received a request to reset your password. This link expires in 30 minutes and can only be used once.\n\n{{resetUrl}}\n\nIf you did not request this, you can ignore this email.",
    },
  });

  await prisma.emailTemplate.upsert({
    where: { key: "MENTOR_APPROVED" },
    update: {},
    create: {
      key: "MENTOR_APPROVED",
      subject: "Your {{universityName}} mentor application has been approved",
      body:
        "Hi {{name}},\n\nGood news — your mentor application for the {{department}} department has been approved on {{decisionDate}}. You can now log in and access the mentor dashboard.\n\n{{loginUrl}}",
    },
  });

  await prisma.emailTemplate.upsert({
    where: { key: "MENTOR_REJECTED" },
    update: {},
    create: {
      key: "MENTOR_REJECTED",
      subject: "Update on your {{universityName}} mentor application",
      body:
        "Hi {{name}},\n\nYour mentor application for the {{department}} department was not approved on {{decisionDate}}.\n\nReason: {{rejectionReason}}\n\nIf you have questions, please contact your department moderator or the university administration.",
    },
  });

  console.log(`Seeded university "${university.name}" with department "${ads.name}" (${ads.code}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
