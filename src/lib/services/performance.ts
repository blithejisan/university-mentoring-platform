import { prisma } from "@/lib/prisma";
import { AuthError, requireMentorOwnsBatch, requireStudentIsSelf } from "@/lib/auth/guards";
import type { AccessTokenPayload } from "@/lib/auth/jwt";
import type { CreatePerformanceInput } from "@/lib/validation/performance";
import { writeAuditLog } from "@/lib/audit";

export async function createPerformanceRecord(
  actor: AccessTokenPayload,
  input: CreatePerformanceInput
) {
  await requireMentorOwnsBatch(actor, input.batchId);

  // Check if student belongs to batch
  const assignment = await prisma.studentBatch.findFirst({
    where: { studentId: input.studentId, batchId: input.batchId, leftAt: null },
  });

  if (!assignment) {
    throw new AuthError("Student is not currently enrolled in this batch.", 400);
  }

  const record = await prisma.performanceRecord.create({
    data: {
      studentId: input.studentId,
      batchId: input.batchId,
      mode: input.mode,
      category: input.mode === "CATEGORY" ? input.category || "General" : "Overall",
      score: input.score,
      recordedById: actor.sub,
    },
    include: {
      student: { include: { user: true } },
      batch: true,
      recordedBy: { select: { universityIdNumber: true, email: true } },
    },
  });

  await writeAuditLog({
    actorId: actor.sub,
    actorRole: actor.role,
    action: "PERFORMANCE_RECORDED",
    targetType: "PerformanceRecord",
    targetId: record.id,
    newValue: { studentId: input.studentId, score: input.score, category: record.category },
  });

  return record;
}

export interface StudentPerformanceOverview {
  studentId: string;
  universityIdNumber: string;
  email: string;
  overallAverage: number;
  totalRecords: number;
  categoryAverages: {
    category: string;
    averageScore: number;
    count: number;
  }[];
  records: {
    id: string;
    batchName: string;
    mode: string;
    category: string | null;
    score: number;
    recordedBy: string;
    recordedAt: Date;
  }[];
  chartData: {
    date: string;
    score: number;
    category: string;
  }[];
}

export async function getStudentPerformance(
  actor: AccessTokenPayload,
  studentUserId: string
): Promise<StudentPerformanceOverview> {
  await requireStudentIsSelf(actor, studentUserId);

  const student = await prisma.studentProfile.findUnique({
    where: { userId: studentUserId },
    include: { user: true, department: { select: { universityId: true } } },
  });

  if (!student) throw new AuthError("Student profile not found.", 404);
  if (student.user.universityId !== student.department.universityId) {
    throw new AuthError("Student not found.", 404);
  }
  if (actor.role === "ADMIN") {
    const admin = await prisma.user.findUnique({ where: { id: actor.sub }, select: { universityId: true } });
    if (!admin || student.user.universityId !== admin.universityId || student.department.universityId !== admin.universityId) {
      throw new AuthError("Student not found.", 404);
    }
  }

  let batchScope: { in: string[] } | undefined;
  if (actor.role === "MENTOR") {
    const mentor = await prisma.mentorProfile.findUnique({ where: { userId: actor.sub }, select: { departmentId: true } });
    if (!mentor) throw new AuthError("Mentor profile not found.", 403);
    if (mentor.departmentId !== student.departmentId) throw new AuthError("Not authorized to view this student.", 403);
    const assignments = await prisma.mentorBatch.findMany({
      where: { mentorId: actor.sub, batch: { departmentId: mentor.departmentId } },
      select: { batchId: true },
    });
    batchScope = { in: assignments.map((assignment) => assignment.batchId) };
  } else if (actor.role === "MODERATOR") {
    const batches = await prisma.batch.findMany({ where: { departmentId: student.departmentId }, select: { id: true } });
    batchScope = { in: batches.map((batch) => batch.id) };
  } else if (actor.role === "ADMIN") {
    const admin = await prisma.user.findUnique({ where: { id: actor.sub }, select: { universityId: true } });
    if (!admin) throw new AuthError("Admin account not found.", 404);
    const batches = await prisma.batch.findMany({
      where: { department: { universityId: admin.universityId } },
      select: { id: true },
    });
    batchScope = { in: batches.map((batch) => batch.id) };
  }

  const records = await prisma.performanceRecord.findMany({
    where: { studentId: studentUserId, ...(batchScope ? { batchId: batchScope } : {}) },
    orderBy: { recordedAt: "desc" },
    include: {
      batch: { select: { name: true } },
      recordedBy: { select: { universityIdNumber: true } },
    },
  });

  if (records.length === 0) {
    return {
      studentId: student.userId,
      universityIdNumber: student.user.universityIdNumber,
      email: student.user.email,
      overallAverage: 0,
      totalRecords: 0,
      categoryAverages: [],
      records: [],
      chartData: [],
    };
  }

  let totalScore = 0;
  const categoryMap = new Map<string, { totalScore: number; count: number }>();

  const formattedRecords = records.map((r) => {
    totalScore += r.score;
    const cat = r.category || "General";
    const existing = categoryMap.get(cat) || { totalScore: 0, count: 0 };
    categoryMap.set(cat, {
      totalScore: existing.totalScore + r.score,
      count: existing.count + 1,
    });

    return {
      id: r.id,
      batchName: r.batch.name,
      mode: r.mode,
      category: r.category,
      score: r.score,
      recordedBy: r.recordedBy.universityIdNumber,
      recordedAt: r.recordedAt,
    };
  });

  const overallAverage = Math.round((totalScore / records.length) * 10) / 10;

  const categoryAverages = Array.from(categoryMap.entries()).map(([category, val]) => ({
    category,
    averageScore: Math.round((val.totalScore / val.count) * 10) / 10,
    count: val.count,
  }));

  const chartData = [...records]
    .reverse()
    .map((r) => ({
      date: new Date(r.recordedAt).toLocaleDateString(),
      score: r.score,
      category: r.category || "Overall",
    }));

  return {
    studentId: student.userId,
    universityIdNumber: student.user.universityIdNumber,
    email: student.user.email,
    overallAverage,
    totalRecords: records.length,
    categoryAverages,
    records: formattedRecords,
    chartData,
  };
}
