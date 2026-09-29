import { z } from "zod";

export const createNoticeSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters.")
    .max(200, "Title must be at most 200 characters."),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters.")
    .max(5000, "Message must be at most 5000 characters."),
  targetType: z.enum(["ALL", "DEPARTMENT", "BATCH", "STUDENT"]),
  targetDepartmentId: z.string().optional(),
  targetBatchId: z.string().optional(),
  targetStudentId: z.string().optional(),
  publishAt: z.string().datetime().optional(),
  expiryAt: z.string().datetime().optional(),
});

export const updateNoticeSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  message: z.string().min(10).max(5000).optional(),
  targetType: z.enum(["ALL", "DEPARTMENT", "BATCH", "STUDENT"]).optional(),
  targetDepartmentId: z.string().optional().nullable(),
  targetBatchId: z.string().optional().nullable(),
  targetStudentId: z.string().optional().nullable(),
  publishAt: z.string().datetime().optional().nullable(),
  expiryAt: z.string().datetime().optional().nullable(),
});

export const listNoticesQuerySchema = z.object({
  batchId: z.string().optional(),
  departmentId: z.string().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
});

export type CreateNoticeInput = z.infer<typeof createNoticeSchema>;
export type UpdateNoticeInput = z.infer<typeof updateNoticeSchema>;
export type ListNoticesQuery = z.infer<typeof listNoticesQuerySchema>;
