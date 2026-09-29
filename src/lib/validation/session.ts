import { z } from "zod";

export const createSessionSchema = z.object({
  batchId: z.string().min(1, "Batch ID is required"),
  date: z.string().min(1, "Session date is required"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  topic: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export const updateSessionSchema = z.object({
  date: z.string().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  topic: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]).optional(),
});

export const attendanceRecordItemSchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
});

export const saveAttendanceSchema = z.object({
  records: z.array(attendanceRecordItemSchema),
  finalize: z.boolean().default(false),
});

export const editFinalizedAttendanceSchema = z.object({
  newStatus: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
  reason: z.string().min(3, "Reason must be at least 3 characters long"),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
export type SaveAttendanceInput = z.infer<typeof saveAttendanceSchema>;
export type EditFinalizedAttendanceInput = z.infer<typeof editFinalizedAttendanceSchema>;
