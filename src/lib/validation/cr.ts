import { z } from "zod";

export const updateCRApplicationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("APPROVE"),
    userId: z.string().min(1),
    batchId: z.string().min(1),
  }),
  z.object({
    action: z.literal("REJECT"),
    userId: z.string().min(1),
  }),
]);

export type UpdateCRApplicationInput = z.infer<typeof updateCRApplicationSchema>;
