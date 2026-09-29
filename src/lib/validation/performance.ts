import { z } from "zod";

export const createPerformanceSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  batchId: z.string().min(1, "Batch ID is required"),
  mode: z.enum(["SIMPLE", "CATEGORY"]),
  category: z.string().optional(),
  score: z.number().min(0, "Score cannot be negative").max(100, "Score cannot exceed 100"),
});

export type CreatePerformanceInput = z.infer<typeof createPerformanceSchema>;
