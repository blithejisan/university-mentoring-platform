import { z } from "zod";

const ratingField = (label: string) =>
  z
    .number()
    .int()
    .min(1, `${label} must be at least 1.`)
    .max(5, `${label} must be at most 5.`);

export const submitEvaluationSchema = z.object({
  mentorId: z.string().min(1, "Mentor selection is required."),
  overallRating: ratingField("Overall rating"),
  communicationRating: ratingField("Communication rating").optional(),
  helpfulnessRating: ratingField("Helpfulness rating").optional(),
  sessionQualityRating: ratingField("Session quality rating").optional(),
  supportRating: ratingField("Support rating").optional(),
  comment: z
    .string()
    .max(2000, "Comment must not exceed 2000 characters.")
    .optional(),
});

export type SubmitEvaluationInput = z.infer<typeof submitEvaluationSchema>;
