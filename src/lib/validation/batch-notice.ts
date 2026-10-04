import { z } from "zod";

const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  url: z
    .string()
    .url()
    .refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    }, "Attachment URL must use HTTP or HTTPS."),
  type: z.string().trim().min(1).max(100),
  size: z.number().int().min(0).max(1_000_000_000),
});

export const createBatchNoticeSchema = z.object({
  title: z.string().trim().min(3).max(200),
  content: z.string().trim().min(1).max(20_000),
  isPinned: z.boolean().default(false),
  attachments: z.array(attachmentSchema).max(10).default([]),
  sendEmailNotification: z.boolean().default(false),
});

export type CreateBatchNoticeInput = z.infer<typeof createBatchNoticeSchema>;
