import 'dotenv/config';
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing required environment variable: DATABASE_URL.");
}
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminId = process.env.SEED_ADMIN_ID?.trim();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim();
  const moderatorId = process.env.SEED_MODERATOR_ID?.trim();
  const moderatorPassword = process.env.SEED_MODERATOR_PASSWORD;
  const moderatorEmail = process.env.SEED_MODERATOR_EMAIL?.trim();
  const mentorId = process.env.SEED_MENTOR_ID?.trim();
  const mentorEmail = process.env.SEED_MENTOR_EMAIL?.trim();
  const mentorPassword = process.env.SEED_MENTOR_PASSWORD;
  const mentorName = process.env.SEED_MENTOR_NAME?.trim();

  const seedAccounts = [
    [
      "SEED_ADMIN_ID",
      adminId,
      "SEED_ADMIN_EMAIL",
      adminEmail,
      "SEED_ADMIN_PASSWORD",
      adminPassword,
    ],
    [
      "SEED_MODERATOR_ID",
      moderatorId,
      "SEED_MODERATOR_EMAIL",
      moderatorEmail,
      "SEED_MODERATOR_PASSWORD",
      moderatorPassword,
    ],
    [
      "SEED_MENTOR_ID",
      mentorId,
      "SEED_MENTOR_EMAIL",
      mentorEmail,
      "SEED_MENTOR_PASSWORD",
      mentorPassword,
      "SEED_MENTOR_NAME",
      mentorName,
    ],
  ] as const;
  for (const fields of seedAccounts) {
    const values = fields.filter((_, index) => index % 2 === 1);
    if (values.some(Boolean) && values.some((value) => !value)) {
      const names = fields.filter((_, index) => index % 2 === 0);
      throw new Error(`Configure all of these seed variables together: ${names.join(", ")}.`);
    }
  }
  if (seedAccounts.every((fields) => fields.filter((_, index) => index % 2 === 1).every((value) => !value))) {
    console.log("No seed users configured; user accounts will be skipped.");
  }

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

  // Registration only creates STUDENT or MENTOR accounts; seed an admin
  // only when explicit credentials are configured.
  if (adminId && adminPassword && adminEmail) {
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
      console.log("Seeded admin account.");
    } else {
      console.log("Admin account already exists, skipping.");
    }
  }

  if (moderatorId && moderatorPassword && moderatorEmail) {
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
      console.log("Seeded moderator account.");
    } else {
      console.log("Moderator account already exists, skipping.");
    }
  }

  if (mentorId && mentorEmail && mentorPassword && mentorName) {
    const existingMentor = await prisma.user.findUnique({
      where: { universityIdNumber: mentorId },
    });

    if (!existingMentor) {
      const now = new Date();
      await prisma.user.create({
        data: {
          universityId: university.id,
          role: "MENTOR",
          universityIdNumber: mentorId,
          name: mentorName,
          email: mentorEmail,
          passwordHash: await bcrypt.hash(mentorPassword, 12),
          status: "ACTIVE",
          emailVerifiedAt: now,
          mentorProfile: {
            create: { departmentId: ads.id, approvalStatus: "APPROVED", approvedAt: now },
          },
        },
      });
      console.log("Seeded approved ADS mentor account.");
    } else {
      console.log("Mentor account already exists, skipping.");
    }
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
