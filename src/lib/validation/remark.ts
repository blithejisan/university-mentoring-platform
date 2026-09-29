import { z } from "zod";

export const createRemarkSchema = z.object({
  studentId: z.string().min(1, "Student ID is required."),
  batchId: z.string().min(1, "Batch ID is required."),
  type: z
    .string()
    .min(2, "Type must be at least 2 characters.")
    .max(50, "Type must be at most 50 characters."),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters.")
    .max(2000, "Description must be at most 2000 characters."),
});

export const updateRemarkStatusSchema = z.object({
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED"]),
  resolutionNote: z.string().max(2000).optional().nullable(),
});

export const listRemarksQuerySchema = z.object({
  studentId: z.string().optional(),
  batchId: z.string().optional(),
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED"]).optional(),
});

export type CreateRemarkInput = z.infer<typeof createRemarkSchema>;
export type UpdateRemarkStatusInput = z.infer<typeof updateRemarkStatusSchema>;
export type ListRemarksQuery = z.infer<typeof listRemarksQuerySchema>;
