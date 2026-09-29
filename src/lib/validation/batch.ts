import { z } from "zod";

export const createBatchSchema = z.object({
  departmentId: z.string().min(1, "Department ID is required"),
  name: z.string().min(2, "Batch name must be at least 2 characters"),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const createMentorBatchSchema = createBatchSchema.omit({ departmentId: true });

export const updateBatchSchema = z.object({
  name: z.string().min(2, "Batch name must be at least 2 characters").optional(),
  description: z.string().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
});

export const assignStudentSchema = z.object({
  studentUserId: z.string().min(1, "Student user ID is required"),
});

export const addStudentByIdSchema = z.object({
  universityIdNumber: z.string().trim().min(3, "Student ID must be at least 3 characters"),
  name: z.string().trim().min(1, "Student name is required").max(120).optional(),
  email: z.string().trim().email("Enter a valid email address").toLowerCase().optional(),
  phone: z.string().trim().max(40).optional(),
});

export const importStudentRowsSchema = z.array(
  z.object({
    universityIdNumber: z.string().trim().min(3, "Student ID must be at least 3 characters"),
    name: z.string().trim().min(1, "Student name is required").max(120),
    email: z.string().trim().email("Enter a valid email address").toLowerCase(),
    phone: z.string().trim().min(1, "Phone number is required").max(40),
  })
);

export const assignMentorSchema = z.object({
  mentorUserId: z.string().min(1, "Mentor user ID is required"),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type CreateMentorBatchInput = z.infer<typeof createMentorBatchSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
export type AssignStudentInput = z.infer<typeof assignStudentSchema>;
export type AddStudentByIdInput = z.infer<typeof addStudentByIdSchema>;
export type ImportStudentRowInput = z.infer<typeof importStudentRowsSchema>[number];
export type AssignMentorInput = z.infer<typeof assignMentorSchema>;
