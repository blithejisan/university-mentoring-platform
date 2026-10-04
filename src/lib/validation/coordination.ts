import { z } from "zod";

export const createCoordinationNoticeSchema = z.object({
  title: z.string().trim().min(3).max(200),
  content: z.string().trim().min(1).max(5000),
  targetBatchId: z.string().trim().min(1).nullable().optional(),
});

export const createCoordinationSupportNoteSchema = z.object({
  batchId: z.string().trim().min(1),
  studentId: z.string().trim().min(1).nullable().optional(),
  title: z.string().trim().min(3).max(200),
  message: z.string().trim().min(1).max(5000),
});

export const createCoordinationCommentSchema = z.object({
  content: z.string().trim().min(1).max(3000),
});

export const updateCoordinationSupportStatusSchema = z.object({
  status: z.enum(["OPEN", "RESOLVED"]),
});

export const searchCoordinationStudentsQuerySchema = z.object({
  q: z.string().trim().min(2).max(100).optional(),
  batchId: z.string().trim().min(1).max(100).optional(),
}).refine(
  (query) => Boolean(query.batchId) !== Boolean(query.q),
  { message: "Provide either a batch ID or a student ID search query." }
);

export type CreateCoordinationNoticeInput = z.infer<typeof createCoordinationNoticeSchema>;
export type CreateCoordinationSupportNoteInput = z.infer<typeof createCoordinationSupportNoteSchema>;
