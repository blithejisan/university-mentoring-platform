import { prisma } from "@/lib/prisma";
import { AuthError, requireMentorOwnsBatch, requireModeratorOwnsDepartment, requireStudentIsSelf } from "@/lib/auth/guards";
import type { AccessTokenPayload } from "@/lib/auth/jwt";
import { reportDateWhere, type ReportFilters } from "@/lib/validation/report-filters";
import { compareStudentIds } from "@/lib/student-sorting";

export interface StudentAttendanceSummary {
  studentId: string;
  universityIdNumber: string;
  email: string;
  departmentId: string;
  departmentName: string;
  lowAttendanceThreshold: number;
  totalApplicableSessions: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  attendancePercentage: number;
  isLowAttendance: boolean;
  batchSummaries: {
    batchId: string;
    batchName: string;
    applicableSessions: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    percentage: number;
  }[];
  availableBatches: { batchId: string; batchName: string }[];
  sessionHistory: {
    sessionId: string;
    date: Date;
    topic: string | null;
    batchName: string;
    status: string; // AttendanceStatus or "UNRECORDED"
  }[];
}

export async function getStudentAttendanceSummary(
  actor: AccessTokenPayload,
  studentUserId: string,
  filters: ReportFilters = {}
): Promise<StudentAttendanceSummary> {
  await requireStudentIsSelf(actor, studentUserId);

  const student = await prisma.studentProfile.findUnique({
    where: { userId: studentUserId },
    include: {
      user: true,
      department: true,
      studentBatches: {
        include: {
          batch: { include: { department: { select: { universityId: true } } } },
        },
      },
    },
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
  let accessibleBatchIds: Set<string> | undefined;
  if (actor.role === "MENTOR") {
    const mentor = await prisma.mentorProfile.findUnique({ where: { userId: actor.sub }, select: { departmentId: true } });
    if (!mentor) throw new AuthError("Mentor profile not found.", 403);
    if (mentor.departmentId !== student.departmentId) throw new AuthError("Not authorized to view this student.", 403);
    const assignments = await prisma.mentorBatch.findMany({
      where: { mentorId: actor.sub, batch: { departmentId: mentor.departmentId } },
      select: { batchId: true },
    });
    accessibleBatchIds = new Set(assignments.map((assignment) => assignment.batchId));
  } else if (actor.role === "MODERATOR") {
    accessibleBatchIds = new Set(
      (await prisma.batch.findMany({ where: { departmentId: student.departmentId }, select: { id: true } }))
        .map((batch) => batch.id)
    );
  } else if (actor.role === "ADMIN") {
    const admin = await prisma.user.findUnique({ where: { id: actor.sub }, select: { universityId: true } });
    if (!admin) throw new AuthError("Admin account not found.", 404);
    accessibleBatchIds = new Set(
      (await prisma.batch.findMany({
        where: { department: { universityId: admin.universityId } },
        select: { id: true },
      })).map((batch) => batch.id)
    );
  }
  const accessibleMemberships = student.studentBatches.filter((membership) =>
    membership.batch.departmentId === student.departmentId &&
    (!accessibleBatchIds || accessibleBatchIds.has(membership.batchId))
  );
  if (filters.departmentId && filters.departmentId !== student.departmentId) {
    throw new AuthError("Department not found.", 404);
  }
  if (filters.batchId && !accessibleMemberships.some((membership) => membership.batchId === filters.batchId)) {
    throw new AuthError("Batch not found.", 404);
  }

  let mentorId: string | undefined;
  if (filters.mentorId) {
    if (actor.role === "MENTOR" && filters.mentorId !== actor.sub) {
      throw new AuthError("Not authorized to filter by this mentor.", 403);
    }
    if (actor.role !== "ADMIN" && actor.role !== "MODERATOR" && actor.role !== "MENTOR") {
      throw new AuthError("Not authorized to filter by mentor.", 403);
    }
    const mentor = await prisma.mentorProfile.findUnique({
      where: { userId: filters.mentorId },
      include: { user: { select: { universityId: true } } },
    });
    if (!mentor || mentor.departmentId !== student.departmentId) throw new AuthError("Mentor not found.", 404);
    if (actor.role === "ADMIN") {
      const admin = await prisma.user.findUnique({ where: { id: actor.sub }, select: { universityId: true } });
      if (!admin || mentor.user.universityId !== admin.universityId) throw new AuthError("Mentor not found.", 404);
    }
    mentorId = filters.mentorId;
  }

  const threshold = student.department.lowAttendanceThreshold;
  let totalApplicableSessions = 0;
  let totalPresent = 0;
  let totalAbsent = 0;
  let totalLate = 0;
  let totalExcused = 0;

  const batchSummaries = [];
  const sessionHistory = [];
  const availableBatches = accessibleMemberships.map((membership) => ({
    batchId: membership.batchId,
    batchName: membership.batch.name,
  }));

  for (const sb of accessibleMemberships) {
    if (filters.batchId && sb.batchId !== filters.batchId) continue;
    // Find sessions for this batch
    const sessions = await prisma.attendanceSession.findMany({
      where: {
        batchId: sb.batchId,
        status: "COMPLETED",
        ...(mentorId ? { mentorId } : {}),
        date: {
          ...(reportDateWhere(filters) ?? {}),
          gte: filters.from && filters.from > sb.joinedAt ? filters.from : sb.joinedAt,
          ...(sb.leftAt || filters.to
            ? { lte: sb.leftAt && filters.to
              ? (sb.leftAt < filters.to ? sb.leftAt : filters.to)
              : sb.leftAt ?? filters.to }
            : {}),
        },
      },
      orderBy: { date: "desc" },
      include: {
        attendanceRecords: {
          where: { studentId: studentUserId },
        },
      },
    });

    let bPresent = 0;
    let bAbsent = 0;
    let bLate = 0;
    let bExcused = 0;

    for (const s of sessions) {
      const record = s.attendanceRecords[0];
      const recStatus = record ? record.status : "ABSENT";

      if (recStatus === "PRESENT") bPresent++;
      else if (recStatus === "ABSENT") bAbsent++;
      else if (recStatus === "LATE") bLate++;
      else if (recStatus === "EXCUSED") bExcused++;

      sessionHistory.push({
        sessionId: s.id,
        date: s.date,
        topic: s.topic,
        batchName: sb.batch.name,
        status: recStatus,
      });
    }

    const bApplicable = sessions.length;
    const bPercentage = bApplicable === 0 ? 100 : Math.round(((bPresent + bExcused) / bApplicable) * 100);

    batchSummaries.push({
      batchId: sb.batchId,
      batchName: sb.batch.name,
      applicableSessions: bApplicable,
      present: bPresent,
      absent: bAbsent,
      late: bLate,
      excused: bExcused,
      percentage: bPercentage,
    });

    totalApplicableSessions += bApplicable;
    totalPresent += bPresent;
    totalAbsent += bAbsent;
    totalLate += bLate;
    totalExcused += bExcused;
  }

  const attendancePercentage =
    totalApplicableSessions === 0
      ? 100
      : Math.round(((totalPresent + totalExcused) / totalApplicableSessions) * 100);

  const isLowAttendance = totalApplicableSessions > 0 && attendancePercentage < threshold;

  return {
    studentId: student.userId,
    universityIdNumber: student.user.universityIdNumber,
    email: student.user.email,
    departmentId: student.departmentId,
    departmentName: student.department.name,
    lowAttendanceThreshold: threshold,
    totalApplicableSessions,
    presentCount: totalPresent,
    absentCount: totalAbsent,
    lateCount: totalLate,
    excusedCount: totalExcused,
    attendancePercentage,
    isLowAttendance,
    batchSummaries,
    availableBatches,
    sessionHistory,
  };
}

export interface BatchStudentAttendanceRow {
  studentId: string;
  universityIdNumber: string;
  email: string;
  applicableSessions: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  percentage: number;
  isLowAttendance: boolean;
}

export interface BatchAttendanceReport {
  batchId: string;
  batchName: string;
  departmentId: string;
  departmentName: string;
  lowAttendanceThreshold: number;
  totalCompletedSessions: number;
  batchAveragePercentage: number;
  lowAttendanceStudentCount: number;
  students: BatchStudentAttendanceRow[];
}

export async function getBatchAttendanceReport(
  actor: AccessTokenPayload,
  batchId: string,
  filters: ReportFilters = {}
): Promise<BatchAttendanceReport> {
  await requireMentorOwnsBatch(actor, batchId);

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: {
      department: true,
      studentBatches: {
        orderBy: { student: { user: { universityIdNumber: "asc" } } },
        include: {
          student: {
            include: { user: true, department: { select: { universityId: true } } },
          },
        },
      },
      attendanceSessions: {
        where: {
          status: "COMPLETED",
          ...(reportDateWhere(filters) ? { date: reportDateWhere(filters) } : {}),
          ...(filters.mentorId ? { mentorId: filters.mentorId } : {}),
        },
        orderBy: { date: "asc" },
        include: {
          attendanceRecords: true,
        },
      },
    },
  });

  if (!batch) throw new AuthError("Batch not found.", 404);
  if (actor.role === "ADMIN") {
    const admin = await prisma.user.findUnique({ where: { id: actor.sub }, select: { universityId: true } });
    if (!admin || batch.department.universityId !== admin.universityId) throw new AuthError("Batch not found.", 404);
  }
  if (filters.departmentId && filters.departmentId !== batch.departmentId) throw new AuthError("Batch not found.", 404);
  if (filters.mentorId) {
    if (actor.role === "MENTOR" && filters.mentorId !== actor.sub) {
      throw new AuthError("Not authorized to filter by this mentor.", 403);
    }
    if (actor.role !== "ADMIN" && actor.role !== "MODERATOR" && actor.role !== "MENTOR") {
      throw new AuthError("Not authorized to filter by mentor.", 403);
    }
    const mentor = await prisma.mentorProfile.findUnique({
      where: { userId: filters.mentorId },
      include: { user: { select: { universityId: true } } },
    });
    if (!mentor || mentor.departmentId !== batch.departmentId) throw new AuthError("Mentor not found.", 404);
    if (actor.role === "ADMIN") {
      const admin = await prisma.user.findUnique({ where: { id: actor.sub }, select: { universityId: true } });
      if (!admin || mentor.user.universityId !== admin.universityId) throw new AuthError("Mentor not found.", 404);
    }
  }

  const threshold = batch.department.lowAttendanceThreshold;
  const completedSessions = batch.attendanceSessions;
  const scopedStudentBatches = batch.studentBatches.filter((membership) =>
    membership.student.departmentId === batch.departmentId &&
    membership.student.department.universityId === batch.department.universityId &&
    membership.student.user.universityId === batch.department.universityId
  );
  const studentRows: BatchStudentAttendanceRow[] = [];

  let sumPercentages = 0;
  let lowAttendanceCount = 0;

  for (const sb of scopedStudentBatches) {
    const studentId = sb.studentId;
    const applicable = completedSessions;

    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    for (const s of applicable) {
      const record = s.attendanceRecords.find((r) => r.studentId === studentId);
      // A completed session without a record counts as an absence.
      const st = record ? record.status : "ABSENT";
      if (st === "PRESENT") present++;
      else if (st === "ABSENT") absent++;
      else if (st === "LATE") late++;
      else if (st === "EXCUSED") excused++;
    }

    const totalApp = applicable.length;
    const percentage = totalApp === 0 ? 100 : Math.round(((present + excused) / totalApp) * 100);
    const isLow = totalApp > 0 && percentage < threshold;

    if (isLow) lowAttendanceCount++;
    sumPercentages += percentage;

    studentRows.push({
      studentId,
      universityIdNumber: sb.student.user.universityIdNumber,
      email: sb.student.user.email,
      applicableSessions: totalApp,
      present,
      absent,
      late,
      excused,
      percentage,
      isLowAttendance: isLow,
    });
  }

  const batchAverage =
    studentRows.length === 0 ? 100 : Math.round(sumPercentages / studentRows.length);
  studentRows.sort((a, b) => compareStudentIds(a.universityIdNumber, b.universityIdNumber));

  return {
    batchId: batch.id,
    batchName: batch.name,
    departmentId: batch.departmentId,
    departmentName: batch.department.name,
    lowAttendanceThreshold: threshold,
    totalCompletedSessions: completedSessions.length,
    batchAveragePercentage: batchAverage,
    lowAttendanceStudentCount: lowAttendanceCount,
    students: studentRows,
  };
}

export interface DepartmentAttendanceOverview {
  departmentId: string;
  departmentName: string;
  lowAttendanceThreshold: number;
  totalStudents: number;
  totalBatches: number;
  lowAttendanceStudentsCount: number;
  lowAttendanceStudents: {
    studentId: string;
    universityIdNumber: string;
    email: string;
    batchName: string;
    attendancePercentage: number;
  }[];
  filterOptions: {
    batches: { batchId: string; batchName: string }[];
    mentors: { mentorId: string; name: string | null; universityIdNumber: string }[];
  };
}

export async function getDepartmentAttendanceOverview(
  actor: AccessTokenPayload,
  filters: ReportFilters = {}
): Promise<DepartmentAttendanceOverview> {
  let departmentId = filters.departmentId;
  if (actor.role === "MODERATOR") {
    const moderator = await prisma.moderatorProfile.findUnique({ where: { userId: actor.sub } });
    if (!moderator) throw new AuthError("Moderator profile not found.", 403);
    if (departmentId && departmentId !== moderator.departmentId) throw new AuthError("Department not found.", 404);
    departmentId = moderator.departmentId;
  } else if (actor.role !== "ADMIN") {
    throw new AuthError("Not authorized to view department overview.", 403);
  }

  if (!departmentId) throw new AuthError("Department ID is required.", 400);

  await requireModeratorOwnsDepartment(actor, departmentId);

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    include: {
      batches: {
        include: {
          studentBatches: {
            where: { leftAt: null },
            include: {
              student: { include: { user: true } },
            },
          },
        },
      },
    },
  });

  if (!department) throw new AuthError("Department not found.", 404);
  if (actor.role === "ADMIN") {
    const admin = await prisma.user.findUnique({ where: { id: actor.sub }, select: { universityId: true } });
    if (!admin || department.universityId !== admin.universityId) throw new AuthError("Department not found.", 404);
  }

  const scopedBatches = filters.batchId
    ? department.batches.filter((batch) => batch.id === filters.batchId)
    : department.batches;
  if (filters.batchId && scopedBatches.length === 0) throw new AuthError("Batch not found.", 404);
  if (filters.mentorId) {
    const mentor = await prisma.mentorProfile.findUnique({
      where: { userId: filters.mentorId },
      include: { user: { select: { universityId: true } } },
    });
    if (!mentor || mentor.departmentId !== department.id) throw new AuthError("Mentor not found.", 404);
    if (actor.role === "ADMIN") {
      const admin = await prisma.user.findUnique({ where: { id: actor.sub }, select: { universityId: true } });
      if (!admin || mentor.user.universityId !== admin.universityId) throw new AuthError("Mentor not found.", 404);
    }
  }

  const threshold = department.lowAttendanceThreshold;
  const lowAttendanceStudents = [];
  let totalStudents = 0;

  for (const batch of scopedBatches) {
    totalStudents += batch.studentBatches.filter((membership) =>
      membership.student.departmentId === department.id &&
      membership.student.user.universityId === department.universityId
    ).length;

    const report = await getBatchAttendanceReport(actor, batch.id, filters);
    for (const s of report.students) {
      if (s.isLowAttendance) {
        lowAttendanceStudents.push({
          studentId: s.studentId,
          universityIdNumber: s.universityIdNumber,
          email: s.email,
          batchName: batch.name,
          attendancePercentage: s.percentage,
        });
      }
    }
  }
  lowAttendanceStudents.sort((a, b) =>
    compareStudentIds(a.universityIdNumber, b.universityIdNumber)
  );

  const mentors = await prisma.mentorProfile.findMany({
    where: { departmentId: department.id },
    select: {
      userId: true,
      user: { select: { name: true, universityIdNumber: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  return {
    departmentId: department.id,
    departmentName: department.name,
    lowAttendanceThreshold: threshold,
    totalStudents,
    totalBatches: scopedBatches.length,
    lowAttendanceStudentsCount: lowAttendanceStudents.length,
    lowAttendanceStudents,
    filterOptions: {
      batches: department.batches.map((batch) => ({ batchId: batch.id, batchName: batch.name })),
      mentors: mentors.map((mentor) => ({
        mentorId: mentor.userId,
        name: mentor.user.name,
        universityIdNumber: mentor.user.universityIdNumber,
      })),
    },
  };
}
