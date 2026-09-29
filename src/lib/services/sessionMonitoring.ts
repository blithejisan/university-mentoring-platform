import type { AttendanceStatus, RemarkStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthError, requireModeratorOwnsDepartment } from "@/lib/auth/guards";
import type { AccessTokenPayload } from "@/lib/auth/jwt";
import { reportDateWhere, type ReportFilters } from "@/lib/validation/report-filters";

type SessionCounts = {
  totalSessions: number;
  scheduledSessions: number;
  upcomingSessions: number;
  completedSessions: number;
  cancelledSessions: number;
};

type RemarkCounts = {
  totalRemarks: number;
  openRemarks: number;
  inReviewRemarks: number;
  resolvedRemarks: number;
};

type AttendanceCounts = {
  totalRecords: number;
  finalizedRecords: number;
  draftRecords: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
};

type Activity = SessionCounts & {
  attendance: AttendanceCounts;
  remarks: RemarkCounts;
};

const ATTENDANCE_STATUSES: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];
const REMARK_STATUSES: RemarkStatus[] = ["OPEN", "IN_REVIEW", "RESOLVED"];

function emptySessionCounts(): SessionCounts {
  return {
    totalSessions: 0,
    scheduledSessions: 0,
    upcomingSessions: 0,
    completedSessions: 0,
    cancelledSessions: 0,
  };
}

function emptyRemarkCounts(): RemarkCounts {
  return { totalRemarks: 0, openRemarks: 0, inReviewRemarks: 0, resolvedRemarks: 0 };
}

function emptyAttendanceCounts(): AttendanceCounts {
  return {
    totalRecords: 0,
    finalizedRecords: 0,
    draftRecords: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
  };
}

function emptyActivity(): Activity {
  return {
    ...emptySessionCounts(),
    attendance: emptyAttendanceCounts(),
    remarks: emptyRemarkCounts(),
  };
}

function addSession(activity: SessionCounts, status: string, date: Date, now: Date) {
  activity.totalSessions++;
  if (status === "SCHEDULED") {
    activity.scheduledSessions++;
    if (date >= now) activity.upcomingSessions++;
  } else if (status === "COMPLETED") {
    activity.completedSessions++;
  } else if (status === "CANCELLED") {
    activity.cancelledSessions++;
  }
}

function addRemark(activity: RemarkCounts, status: RemarkStatus, count: number) {
  activity.totalRemarks += count;
  if (status === "OPEN") activity.openRemarks += count;
  else if (status === "IN_REVIEW") activity.inReviewRemarks += count;
  else if (status === "RESOLVED") activity.resolvedRemarks += count;
}

export async function getSessionMonitoring(
  actor: AccessTokenPayload,
  filters: ReportFilters = {}
) {
  let departmentFilter: { id: string; name: string }[];

  if (actor.role === "MODERATOR") {
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
      select: { id: true, name: true },
    });
    if (!department) throw new AuthError("Department not found.", 404);
    departmentFilter = [department];
  } else if (actor.role === "ADMIN") {
    const admin = await prisma.user.findUnique({
      where: { id: actor.sub },
      select: { universityId: true },
    });
    if (!admin) throw new AuthError("Admin account not found.", 404);

    departmentFilter = await prisma.department.findMany({
      where: {
        universityId: admin.universityId,
        ...(filters.departmentId ? { id: filters.departmentId } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    if (filters.departmentId && departmentFilter.length === 0) {
      throw new AuthError("Department not found.", 404);
    }
  } else {
    throw new AuthError("Not authorized to view session monitoring.", 403);
  }

  const departmentIds = departmentFilter.map((department) => department.id);
  if (departmentIds.length === 0) {
    return {
      departments: [],
      summary: emptySessionCounts(),
      attendance: emptyAttendanceCounts(),
      remarks: emptyRemarkCounts(),
      batches: [],
      mentors: [],
      filterOptions: { batches: [], mentors: [] },
    };
  }

  const departmentIdSet = new Set(departmentIds);
  const availableBatches = await prisma.batch.findMany({
    where: { departmentId: { in: departmentIds } },
    select: { id: true, name: true, departmentId: true },
    orderBy: { name: "asc" },
  });
  if (filters.batchId && !availableBatches.some((batch) => batch.id === filters.batchId)) {
    throw new AuthError("Batch not found.", 404);
  }
  const scopedBatches = filters.batchId
    ? availableBatches.filter((batch) => batch.id === filters.batchId)
    : availableBatches;
  const availableMentors = await prisma.mentorProfile.findMany({
    where: { departmentId: { in: departmentIds } },
    select: {
      userId: true,
      user: { select: { name: true, universityIdNumber: true } },
    },
    orderBy: { user: { name: "asc" } },
  });
  if (filters.mentorId && !availableMentors.some((mentor) => mentor.userId === filters.mentorId)) {
    throw new AuthError("Mentor not found.", 404);
  }
  const batchIds = scopedBatches.map((batch) => batch.id);
  const sessionDateFilter = reportDateWhere(filters);
  const now = new Date();
  const sessions = await prisma.attendanceSession.findMany({
    where: {
      batchId: { in: batchIds },
      ...(sessionDateFilter ? { date: sessionDateFilter } : {}),
      ...(filters.mentorId ? { mentorId: filters.mentorId } : {}),
    },
    select: {
      id: true,
      batchId: true,
      mentorId: true,
      date: true,
      status: true,
      batch: { select: { departmentId: true } },
    },
  });
  const sessionIds = sessions.map((session) => session.id);
  const [attendanceByStatus, finalizedAttendance, draftAttendance, remarksByOwner] =
    await Promise.all([
      prisma.attendanceRecord.groupBy({
        by: ["sessionId", "status"],
        where: { sessionId: { in: sessionIds } },
        _count: { _all: true },
      }),
      prisma.attendanceRecord.groupBy({
        by: ["sessionId"],
        where: {
          finalizedAt: { not: null },
          sessionId: { in: sessionIds },
        },
        _count: { _all: true },
      }),
      prisma.attendanceRecord.groupBy({
        by: ["sessionId"],
        where: {
          finalizedAt: null,
          sessionId: { in: sessionIds },
        },
        _count: { _all: true },
      }),
      prisma.remark.groupBy({
        by: ["batchId", "mentorId", "status"],
        where: {
          batchId: { in: batchIds },
          ...(filters.mentorId ? { mentorId: filters.mentorId } : {}),
          ...(sessionDateFilter ? { createdAt: sessionDateFilter } : {}),
        },
        _count: { _all: true },
      }),
    ]);

  const summary = emptySessionCounts();
  const attendance = emptyAttendanceCounts();
  const remarks = emptyRemarkCounts();
  const batchActivity = new Map<string, Activity>();
  const mentorActivity = new Map<string, Activity>();
  const departmentActivity = new Map<string, Activity>();
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const batchById = new Map(scopedBatches.map((batch) => [batch.id, batch]));

  for (const batch of scopedBatches) batchActivity.set(batch.id, emptyActivity());
  for (const department of departmentFilter) departmentActivity.set(department.id, emptyActivity());

  for (const session of sessions) {
    const batch = batchActivity.get(session.batchId);
    const department = departmentActivity.get(session.batch.departmentId);
    if (!batch || !department || !departmentIdSet.has(session.batch.departmentId)) continue;

    addSession(summary, session.status, session.date, now);
    addSession(batch, session.status, session.date, now);
    addSession(department, session.status, session.date, now);

    let mentor = mentorActivity.get(session.mentorId);
    if (!mentor) {
      mentor = emptyActivity();
      mentorActivity.set(session.mentorId, mentor);
    }
    addSession(mentor, session.status, session.date, now);
  }

  for (const group of attendanceByStatus) {
    const status = group.status as AttendanceStatus;
    const count = group._count._all;
    const session = sessionById.get(group.sessionId);
    if (!session || !ATTENDANCE_STATUSES.includes(status)) continue;

    attendance.totalRecords += count;
    if (status === "PRESENT") attendance.present += count;
    else if (status === "ABSENT") attendance.absent += count;
    else if (status === "LATE") attendance.late += count;
    else if (status === "EXCUSED") attendance.excused += count;

    const batch = batchActivity.get(session.batchId);
    const mentor = mentorActivity.get(session.mentorId);
    const department = departmentActivity.get(session.batch.departmentId);
    if (batch) {
      batch.attendance.totalRecords += count;
      if (status === "PRESENT") batch.attendance.present += count;
      else if (status === "ABSENT") batch.attendance.absent += count;
      else if (status === "LATE") batch.attendance.late += count;
      else if (status === "EXCUSED") batch.attendance.excused += count;
    }
    if (mentor) {
      mentor.attendance.totalRecords += count;
      if (status === "PRESENT") mentor.attendance.present += count;
      else if (status === "ABSENT") mentor.attendance.absent += count;
      else if (status === "LATE") mentor.attendance.late += count;
      else if (status === "EXCUSED") mentor.attendance.excused += count;
    }
    if (department) {
      department.attendance.totalRecords += count;
      if (status === "PRESENT") department.attendance.present += count;
      else if (status === "ABSENT") department.attendance.absent += count;
      else if (status === "LATE") department.attendance.late += count;
      else if (status === "EXCUSED") department.attendance.excused += count;
    }
  }

  for (const group of finalizedAttendance) {
    const count = group._count._all;
    attendance.finalizedRecords += count;
    const session = sessionById.get(group.sessionId);
    if (!session) continue;
    const batch = batchActivity.get(session.batchId);
    const mentor = mentorActivity.get(session.mentorId);
    const department = departmentActivity.get(session.batch.departmentId);
    if (batch) batch.attendance.finalizedRecords += count;
    if (mentor) mentor.attendance.finalizedRecords += count;
    if (department) department.attendance.finalizedRecords += count;
  }

  for (const group of draftAttendance) {
    const count = group._count._all;
    attendance.draftRecords += count;
    const session = sessionById.get(group.sessionId);
    if (!session) continue;
    const batch = batchActivity.get(session.batchId);
    const mentor = mentorActivity.get(session.mentorId);
    const department = departmentActivity.get(session.batch.departmentId);
    if (batch) batch.attendance.draftRecords += count;
    if (mentor) mentor.attendance.draftRecords += count;
    if (department) department.attendance.draftRecords += count;
  }

  for (const group of remarksByOwner) {
    const status = group.status as RemarkStatus;
    if (!REMARK_STATUSES.includes(status)) continue;
    const count = group._count._all;
    addRemark(remarks, status, count);

    const batch = batchActivity.get(group.batchId);
    const batchInfo = batchById.get(group.batchId);
    const department = batchInfo ? departmentActivity.get(batchInfo.departmentId) : undefined;
    if (batch) addRemark(batch.remarks, status, count);
    if (department) addRemark(department.remarks, status, count);
    let mentor = mentorActivity.get(group.mentorId);
    if (!mentor) {
      mentor = emptyActivity();
      mentorActivity.set(group.mentorId, mentor);
    }
    addRemark(mentor.remarks, status, count);
  }

  const mentorIds = [...mentorActivity.keys()];
  const mentors = mentorIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: mentorIds } },
        select: { id: true, name: true, universityIdNumber: true },
        orderBy: { name: "asc" },
      })
    : [];

  const mentorOptions = availableMentors.map((mentor) => ({
    mentorId: mentor.userId,
    name: mentor.user.name,
    universityIdNumber: mentor.user.universityIdNumber,
  }));

  return {
    departments: departmentFilter.map((department) => ({
      ...department,
      ...(departmentActivity.get(department.id) ?? emptyActivity()),
    })),
    summary,
    attendance,
    remarks,
    batches: scopedBatches.map((batch) => ({
      batchId: batch.id,
      batchName: batch.name,
      departmentId: batch.departmentId,
      ...(batchActivity.get(batch.id) ?? emptyActivity()),
    })),
    mentors: mentors.map((mentor) => ({
      mentorId: mentor.id,
      name: mentor.name,
      universityIdNumber: mentor.universityIdNumber,
      ...(mentorActivity.get(mentor.id) ?? emptyActivity()),
    })),
    filterOptions: {
      batches: availableBatches.map((batch) => ({ batchId: batch.id, batchName: batch.name })),
      mentors: mentorOptions,
    },
  };
}