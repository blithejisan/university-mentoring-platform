import { z } from "zod";

const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be at most 72 characters.");

const email = z.string().trim().email("Enter a valid email address.").toLowerCase();
const optionalEmail = z
  .union([email, z.literal("")])
  .optional()
  .transform((value) => value || undefined);

// Registration is one endpoint; role comes from which form submitted it,
// but the server decides the resulting AccountStatus/approvalStatus —
// the client can request STUDENT or MENTOR, never ADMIN/MODERATOR.
export const studentRegisterSchema = z.object({
  role: z.literal("STUDENT"),
  universityIdNumber: z.string().min(3, "Student ID is required."),
  name: z.string().trim().min(1, "Name is required.").max(120),
  email,
  universityEmail: optionalEmail,
  altEmail: email.optional(),
  password,
  departmentId: z.string().min(1, "Select a department."),
  phone: z.string().optional(),
});

export const mentorRegisterSchema = z.object({
  role: z.literal("MENTOR"),
  universityIdNumber: z.string().min(3, "University ID is required."),
  name: z.string().trim().min(1, "Name is required.").max(120),
  email,
  universityEmail: optionalEmail,
  altEmail: email.optional(),
  password,
  departmentId: z.string().min(1, "Select a department."),
});

export const registerSchema = z.discriminatedUnion("role", [
  studentRegisterSchema,
  mentorRegisterSchema,
]);

export const loginSchema = z.object({
  universityIdNumber: z.string().min(1, "Enter your Student/University ID."),
  password: z.string().min(1, "Enter your password."),
  rememberMe: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, "Enter your Student/University ID or email."),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters.")
      .max(72, "New password must be at most 72 characters.")
      .regex(/[a-z]/, "New password must include a lowercase letter.")
      .regex(/[A-Z]/, "New password must include an uppercase letter.")
      .regex(/[0-9]/, "New password must include a number.")
      .regex(/[^A-Za-z0-9]/, "New password must include a special character."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .strict()
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords do not match.",
    path: ["confirmPassword"],
  });

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});
