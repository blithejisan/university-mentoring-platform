import { prisma } from "@/lib/prisma";
import {
  AuthError,
  requireApprovedMentor,
  requireMentorOwnsBatch,
  requireModeratorOwnsDepartment,
  requireStudentIsSelf,
} from "@/lib/auth/guards";
import type { AccessTokenPayload } from "@/lib/auth/jwt";
import type { CreatePerformanceInput } from "@/lib/validation/performance";
import { reportDateWhere, type ReportFilters } from "@/lib/validation/report-filters";
import { writeAuditLog } from "@/lib/audit";

interface PerformanceValue {
  score: number;
  category: string | null;
}

interface PerformanceStatistics {
  overallAverage: number;
  categoryAverages: { category: string; averageScore: number; count: number }[];
  distribution: { band: string; count: number }[];
}

function calculatePerformanceStatistics(records: PerformanceValue[]): PerformanceStatistics {
  const categoryMap = new Map<string, { totalScore: number; count: number }>();
  let totalScore = 0;
  const distribution = [
    { band: "0-59", min: 0, max: 59, count: 0 },
    { band: "60-69", min: 60, max: 69, count: 0 },
    { band: "70-79", min: 70, max: 79, count: 0 },
    { band: "80-89", min: 80, max: 89, count: 0 },
    { band: "90-100", min: 90, max: 100, count: 0 },
  ];

  for (const record of records) {
    totalScore += record.score;
    const category = record.category || "General";
    const current = categoryMap.get(category) ?? { totalScore: 0, count: 0 };
    categoryMap.set(category, { totalScore: current.totalScore + record.score, count: current.count + 1 });
    const band = distribution.find((item) => record.score >= item.min && record.score <= item.max);
    if (band) band.count++;
  }

  return {
    overallAverage: records.length === 0 ? 0 : Math.round((totalScore / records.length) * 10) / 10,
    categoryAverages: Array.from(categoryMap.entries()).map(([category, value]) => ({
      category,
      averageScore: Math.round((value.totalScore / value.count) * 10) / 10,
      count: value.count,
    })),
    distribution: distribution.map(({ band, count }) => ({ band, count })),
  };
}

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

export interface BatchPerformanceReport {
  batchId: string;
  batchName: string;
  departmentId: string;
  departmentName: string;
  studentCount: number;
  recordCount: number;
  overallAverage: number;
  categoryAverages: PerformanceStatistics["categoryAverages"];
  distribution: PerformanceStatistics["distribution"];
  students: {
    studentId: string;
    universityIdNumber: string;
    email: string;
    recordCount: number;
    averageScore: number;
  }[];
}

export async function getBatchPerformanceReport(
  actor: AccessTokenPayload,
  filters: ReportFilters = {}
) {
  if (actor.role === "STUDENT") throw new AuthError("Students cannot view batch performance reports.", 403);

  let departmentIds: string[];
  let departmentOptions: { id: string; name: string; universityId: string }[];

  if (actor.role === "ADMIN") {
    const admin = await prisma.user.findUnique({ where: { id: actor.sub }, select: { universityId: true } });
    if (!admin) throw new AuthError("Admin account not found.", 404);
    departmentOptions = await prisma.department.findMany({
      where: { universityId: admin.universityId },
      select: { id: true, name: true, universityId: true },
      orderBy: { name: "asc" },
    });
    departmentIds = departmentOptions.map((department) => department.id);
  } else if (actor.role === "MODERATOR") {
    const moderator = await prisma.moderatorProfile.findUnique({
      where: { userId: actor.sub },
      select: { departmentId: true },
    });
    if (!moderator) throw new AuthError("Moderator profile not found.", 403);
    if (filters.departmentId && filters.departmentId !== moderator.departmentId) {
      throw new AuthError("Department not found.", 404);
    }
    await requireModeratorOwnsDepartment(actor, moderator.departmentId);
    const department = await prisma.department.findUnique({
      where: { id: moderator.departmentId },
      select: { id: true, name: true, universityId: true },
    });
    if (!department) throw new AuthError("Department not found.", 404);
    departmentOptions = [department];
    departmentIds = [department.id];
  } else if (actor.role === "MENTOR") {
    await requireApprovedMentor(actor);
    const mentor = await prisma.mentorProfile.findUnique({
      where: { userId: actor.sub },
      select: { departmentId: true },
    });
    if (!mentor) throw new AuthError("Mentor profile not found.", 403);
    if (filters.departmentId && filters.departmentId !== mentor.departmentId) {
      throw new AuthError("Department not found.", 404);
    }
    const department = await prisma.department.findUnique({
      where: { id: mentor.departmentId },
      select: { id: true, name: true, universityId: true },
    });
    if (!department) throw new AuthError("Department not found.", 404);
    departmentOptions = [department];
    departmentIds = [department.id];
  } else {
    throw new AuthError("Not authorized to view batch performance reports.", 403);
  }

  if (filters.departmentId && !departmentIds.includes(filters.departmentId)) {
    throw new AuthError("Department not found.", 404);
  }

  const requestedDepartmentId = filters.departmentId;
  const batches = await prisma.batch.findMany({
    where: {
      departmentId: { in: requestedDepartmentId ? [requestedDepartmentId] : departmentIds },
      ...(actor.role === "MENTOR"
        ? { mentorBatches: { some: { mentorId: actor.sub } } }
        : {}),
    },
    include: { department: { select: { id: true, name: true, universityId: true } } },
    orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
  });

  if (filters.batchId && !batches.some((batch) => batch.id === filters.batchId)) {
    throw new AuthError("Batch not found.", 404);
  }
  if (actor.role === "MENTOR" && filters.batchId) await requireMentorOwnsBatch(actor, filters.batchId);

  const batchIds = batches.map((batch) => batch.id);
  const reportBatches = filters.batchId
    ? batches.filter((batch) => batch.id === filters.batchId)
    : batches;
  const dateFilter = reportDateWhere(filters);
  const records = batchIds.length > 0
    ? await prisma.performanceRecord.findMany({
        where: {
          batchId: { in: batchIds },
          ...(dateFilter ? { recordedAt: dateFilter } : {}),
        },
        include: {
          student: {
            include: {
              user: { select: { universityIdNumber: true, email: true, universityId: true } },
              department: { select: { universityId: true } },
            },
          },
        },
        orderBy: { recordedAt: "desc" },
      })
    : [];

  const batchById = new Map(batches.map((batch) => [batch.id, batch]));
  const scopedRecords = records.filter((record) => {
    const batch = batchById.get(record.batchId);
    return batch &&
      record.student.departmentId === batch.departmentId &&
      record.student.department.universityId === batch.department.universityId &&
      record.student.user.universityId === batch.department.universityId;
  });

  if (actor.role === "MENTOR" && filters.mentorId && filters.mentorId !== actor.sub) {
    throw new AuthError("Not authorized to filter by this mentor.", 403);
  }
  const availableMentors = await prisma.mentorProfile.findMany({
    where: { departmentId: { in: departmentIds } },
    select: {
      userId: true,
      departmentId: true,
      user: { select: { name: true, universityIdNumber: true, universityId: true } },
    },
    orderBy: { user: { name: "asc" } },
  });
  const scopedMentors = availableMentors.filter((mentor) =>
    departmentOptions.some((department) =>
      department.id === mentor.departmentId && department.universityId === mentor.user.universityId
    )
  );
  if (filters.mentorId && !scopedMentors.some((mentor) => mentor.userId === filters.mentorId)) {
    throw new AuthError("Mentor not found.", 404);
  }

  const filteredRecords = filters.mentorId
    ? scopedRecords.filter((record) => record.recordedById === filters.mentorId)
    : scopedRecords;
  const batchReports: BatchPerformanceReport[] = reportBatches.map((batch) => {
    const batchRecords = filteredRecords.filter((record) => record.batchId === batch.id);
    const statistics = calculatePerformanceStatistics(batchRecords);
    const recordsByStudent = new Map<string, typeof batchRecords>();
    for (const record of batchRecords) {
      const current = recordsByStudent.get(record.studentId) ?? [];
      current.push(record);
      recordsByStudent.set(record.studentId, current);
    }

    return {
      batchId: batch.id,
      batchName: batch.name,
      departmentId: batch.departmentId,
      departmentName: batch.department.name,
      studentCount: recordsByStudent.size,
      recordCount: batchRecords.length,
      overallAverage: statistics.overallAverage,
      categoryAverages: statistics.categoryAverages,
      distribution: statistics.distribution,
      students: [...recordsByStudent.entries()]
        .map(([studentId, studentRecords]) => {
          const student = studentRecords[0].student;
          return {
            studentId,
            universityIdNumber: student.user.universityIdNumber,
            email: student.user.email,
            recordCount: studentRecords.length,
            averageScore: calculatePerformanceStatistics(studentRecords).overallAverage,
          };
        })
        .sort((left, right) => left.universityIdNumber.localeCompare(right.universityIdNumber)),
    };
  });

  return {
    batches: batchReports,
    filterOptions: {
      departments: departmentOptions,
      batches: batches.map((batch) => ({ batchId: batch.id, batchName: batch.name })),
      mentors: scopedMentors
        .filter((mentor) => actor.role !== "MENTOR" || mentor.userId === actor.sub)
        .map((mentor) => ({
        mentorId: mentor.userId,
        name: mentor.user.name,
        universityIdNumber: mentor.user.universityIdNumber,
        })),
    },
  };
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

  const statistics = calculatePerformanceStatistics(records);

  const formattedRecords = records.map((r) => {
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
    overallAverage: statistics.overallAverage,
    totalRecords: records.length,
    categoryAverages: statistics.categoryAverages,
    records: formattedRecords,
    chartData,
  };
}
