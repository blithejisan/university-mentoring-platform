import { prisma } from "@/lib/prisma";
import { AuthError, requireMentorOwnsBatch } from "@/lib/auth/guards";
import type { AccessTokenPayload } from "@/lib/auth/jwt";
import type { CreateSessionInput, UpdateSessionInput, SaveAttendanceInput, EditFinalizedAttendanceInput } from "@/lib/validation/session";
import type { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { createUserNotifications, sendTemplatedEmailToUsers } from "@/lib/services/notification";

function sessionMembershipEligibility(session: { date: Date; startTime: Date | null }): Prisma.StudentBatchWhereInput {
  if (session.startTime) {
    return {
      joinedAt: { lte: session.startTime },
      OR: [{ leftAt: null }, { leftAt: { gte: session.startTime } }],
    };
  }

  const dayStart = new Date(Date.UTC(session.date.getUTCFullYear(), session.date.getUTCMonth(), session.date.getUTCDate()));
  const nextDay = new Date(dayStart);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  return {
    joinedAt: { lt: nextDay },
    OR: [{ leftAt: null }, { leftAt: { gte: dayStart } }],
  };
}

function roleDashboard(role: string) {
  return role === "ADMIN" ? "/admin/dashboard" : role === "MODERATOR" ? "/moderator/dashboard" : role === "MENTOR" ? "/mentor/sessions" : "/student/dashboard";
}

async function createSessionNotifications(userIds: string[], sessionId: string, message: string, sourceKey: string) {
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, role: true } });
  for (const user of users) {
    await createUserNotifications([user.id], {
      type: "SESSION",
      title: "Mentoring session update",
      message,
      href: `/${user.role.toLowerCase()}/sessions/${sessionId}`,
      sourceKey,
      sessionId,
    }, "inAppSessions");
  }
}

async function notifySessionParticipants(sessionId: string, message: string, eventKey: string) {
  try {
    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: { batch: { include: { department: true } } },
    });
    if (!session) return;
    const [students, mentorAssignment] = await Promise.all([
      prisma.studentBatch.findMany({
        where: {
          batchId: session.batchId,
          joinedAt: { lte: session.date },
          OR: [{ leftAt: null }, { leftAt: { gte: session.date } }],
          student: { departmentId: session.batch.departmentId, user: { status: "ACTIVE", universityId: session.batch.department.universityId } },
        },
        select: { studentId: true },
      }),
      prisma.mentorBatch.findUnique({
        where: { mentorId_batchId: { mentorId: session.mentorId, batchId: session.batchId } },
        include: { mentor: { select: { approvalStatus: true, departmentId: true, user: { select: { universityId: true, status: true } } } } },
      }),
    ]);
    const userIds = students.map(({ studentId }) => studentId);
    if (
      mentorAssignment?.mentor.approvalStatus === "APPROVED" &&
      mentorAssignment.mentor.user.status === "ACTIVE" &&
      mentorAssignment.mentor.departmentId === session.batch.departmentId &&
      mentorAssignment.mentor.user.universityId === session.batch.department.universityId
    ) userIds.push(session.mentorId);
    await createSessionNotifications(userIds, session.id, message, `session:${session.id}:${eventKey}`);
  } catch {
    // Session creation and editing must not depend on inbox delivery.
  }
}

export async function dispatchSessionReminders(now = new Date()) {
  const candidates = await prisma.attendanceSession.findMany({
    where: {
      status: "SCHEDULED",
      date: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), lte: new Date(now.getTime() + 48 * 60 * 60 * 1000) },
    },
    include: { batch: { include: { department: true } } },
  });

  for (const session of candidates) {
    const startsAt = session.startTime ?? session.date;
    if (startsAt <= now || startsAt.getTime() - 24 * 60 * 60 * 1000 > now.getTime()) continue;
    try {
      const [studentMemberships, mentorAssignment] = await Promise.all([
        prisma.studentBatch.findMany({
          where: {
            batchId: session.batchId,
            joinedAt: { lte: session.date },
            OR: [{ leftAt: null }, { leftAt: { gte: session.date } }],
            student: { departmentId: session.batch.departmentId, user: { status: "ACTIVE", universityId: session.batch.department.universityId } },
          },
          select: { student: { select: { user: { select: { id: true, email: true, name: true, role: true, universityId: true } } } } },
        }),
        prisma.mentorBatch.findUnique({
          where: { mentorId_batchId: { mentorId: session.mentorId, batchId: session.batchId } },
          select: { mentor: { select: { approvalStatus: true, departmentId: true, user: { select: { id: true, email: true, name: true, role: true, status: true, universityId: true } } } } },
        }),
      ]);
      const recipients = studentMemberships.map(({ student }) => student.user);
      const mentor = mentorAssignment?.mentor;
      if (mentor?.approvalStatus === "APPROVED" && mentor.departmentId === session.batch.departmentId && mentor.user.status === "ACTIVE" && mentor.user.universityId === session.batch.department.universityId) {
        recipients.push(mentor.user);
      }
      const dateLabel = startsAt.toLocaleString();
      const details = `${session.topic || "Mentoring session"} for ${session.batch.name} is scheduled for ${dateLabel}${session.location ? ` at ${session.location}` : ""}.`;
      await createSessionNotifications(
        recipients.map((user) => user.id),
        session.id,
        details,
        `session-reminder:${session.id}:${startsAt.toISOString()}`
      );
      await sendTemplatedEmailToUsers(recipients, {
        key: "SESSION_REMINDER",
        type: "SESSION_REMINDER",
        preference: "emailSessionReminders",
        dedupeKey: (userId) => `session-reminder:${session.id}:${startsAt.toISOString()}:${userId}`,
        relatedSessionId: session.id,
        variables: (user) => ({ name: user.name ?? "there", topic: session.topic || session.batch.name, details, url: `${process.env.APP_URL ?? ""}${roleDashboard(user.role ?? "STUDENT")}` }),
      });
    } catch {
      // Reminder delivery is best-effort and must not block session operations.
    }
  }
}

export async function createSession(actor: AccessTokenPayload, input: CreateSessionInput) {
  await requireMentorOwnsBatch(actor, input.batchId);

  let mentorId = actor.sub;
  if (actor.role === "ADMIN" || actor.role === "MODERATOR") {
    const batch = await prisma.batch.findUnique({
      where: { id: input.batchId },
      select: { departmentId: true, department: { select: { universityId: true } } },
    });
    if (!batch) throw new AuthError("Batch not found.", 404);
    const assignedMentor = await prisma.mentorBatch.findFirst({
      where: {
        batchId: input.batchId,
        mentor: {
          approvalStatus: "APPROVED",
          departmentId: batch.departmentId,
          user: { status: "ACTIVE", universityId: batch.department.universityId },
        },
      },
      orderBy: { mentorId: "asc" },
    });
    if (!assignedMentor) throw new AuthError("Assign an active, approved mentor to this batch before scheduling a session.", 400);
    mentorId = assignedMentor.mentorId;
  }

  const session = await prisma.attendanceSession.create({
    data: {
      batchId: input.batchId,
      mentorId,
      date: new Date(input.date),
      startTime: input.startTime ? new Date(input.startTime) : null,
      endTime: input.endTime ? new Date(input.endTime) : null,
      topic: input.topic,
      location: input.location,
      notes: input.notes,
      status: "SCHEDULED",
    },
    include: {
      batch: true,
      mentor: { select: { universityIdNumber: true, email: true } },
    },
  });

  await writeAuditLog({
    actorId: actor.sub,
    actorRole: actor.role,
    action: "SESSION_CREATED",
    targetType: "AttendanceSession",
    targetId: session.id,
    newValue: { topic: session.topic, date: session.date.toISOString(), batchId: session.batchId },
  });

  await notifySessionParticipants(
    session.id,
    `${session.topic || "A mentoring session"} has been scheduled for ${session.date.toLocaleString()}${session.location ? ` at ${session.location}` : ""}.`,
    "created"
  );

  return session;
}

export async function updateSession(actor: AccessTokenPayload, sessionId: string, input: UpdateSessionInput) {
  const session = await prisma.attendanceSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new AuthError("Session not found.", 404);

  await requireMentorOwnsBatch(actor, session.batchId);

  if (input.status === "COMPLETED") {
    throw new AuthError("A session can only be completed by finalizing attendance.", 400);
  }
  if (session.status === "COMPLETED" && input.status !== undefined) {
    throw new AuthError("A completed session cannot change status.", 400);
  }

  const updated = await prisma.attendanceSession.update({
    where: { id: sessionId },
    data: {
      ...(input.date ? { date: new Date(input.date) } : {}),
      ...(input.startTime !== undefined ? { startTime: input.startTime ? new Date(input.startTime) : null } : {}),
      ...(input.endTime !== undefined ? { endTime: input.endTime ? new Date(input.endTime) : null } : {}),
      ...(input.topic !== undefined ? { topic: input.topic } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    include: {
      batch: true,
      mentor: { select: { universityIdNumber: true, email: true } },
    },
  });

  await writeAuditLog({
    actorId: actor.sub,
    actorRole: actor.role,
    action: "SESSION_UPDATED",
    targetType: "AttendanceSession",
    targetId: sessionId,
    previousValue: { status: session.status, topic: session.topic },
    newValue: { status: updated.status, topic: updated.topic },
  });

  const changed = session.date.getTime() !== updated.date.getTime() || session.status !== updated.status || session.startTime?.getTime() !== updated.startTime?.getTime() || session.endTime?.getTime() !== updated.endTime?.getTime() || session.location !== updated.location || session.topic !== updated.topic;
  if (changed) {
    await notifySessionParticipants(
      sessionId,
      updated.status === "CANCELLED"
        ? `${updated.topic || "A mentoring session"} has been cancelled.`
        : `${updated.topic || "A mentoring session"} has been updated: ${updated.date.toLocaleString()}${updated.location ? ` at ${updated.location}` : ""}.`,
      `updated:${updated.date.getTime()}:${updated.startTime?.getTime() ?? "none"}:${updated.status}`
    );
  }

  return updated;
}

export async function listSessionsForBatch(actor: AccessTokenPayload, batchId: string) {
  if (actor.role === "STUDENT") {
    const [student, batch] = await Promise.all([
      prisma.studentProfile.findUnique({ where: { userId: actor.sub }, select: { departmentId: true, user: { select: { universityId: true, status: true } } } }),
      prisma.batch.findUnique({ where: { id: batchId }, select: { departmentId: true, department: { select: { universityId: true } } } }),
    ]);
    if (!student || !batch || student.user.status !== "ACTIVE" || student.departmentId !== batch.departmentId || student.user.universityId !== batch.department.universityId) {
      throw new AuthError("Batch not found.", 404);
    }
    const membership = await prisma.studentBatch.findFirst({
      where: { studentId: actor.sub, batchId, leftAt: null },
      select: { studentId: true, joinedAt: true },
    });
    if (!membership) throw new AuthError("Batch not found.", 404);

    const sessions = await prisma.attendanceSession.findMany({
      where: { batchId, date: { gte: membership.joinedAt } },
      orderBy: { date: "desc" },
      select: {
        id: true,
        batchId: true,
        date: true,
        startTime: true,
        endTime: true,
        topic: true,
        location: true,
        status: true,
        attendanceRecords: {
          where: { studentId: actor.sub },
          select: { status: true, finalizedAt: true },
        },
      },
    });

    return sessions.map(({ attendanceRecords, ...session }) => ({
      ...session,
      attendanceRecord: attendanceRecords[0] ?? null,
    }));
  }

  await requireMentorOwnsBatch(actor, batchId);

  return prisma.attendanceSession.findMany({
    where: { batchId },
    orderBy: { date: "desc" },
    include: {
      mentor: { select: { universityIdNumber: true, email: true } },
      _count: { select: { attendanceRecords: true } },
    },
  });
}

export async function getSessionDetails(actor: AccessTokenPayload, sessionId: string) {
  if (actor.role === "STUDENT") {
    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        batchId: true,
        date: true,
        startTime: true,
        endTime: true,
        topic: true,
        location: true,
        status: true,
        batch: { select: { id: true, name: true, departmentId: true, department: { select: { universityId: true } } } },
      },
    });

    if (!session) throw new AuthError("Session not found.", 404);

    const student = await prisma.studentProfile.findUnique({ where: { userId: actor.sub }, select: { departmentId: true, user: { select: { universityId: true, status: true } } } });
    if (!student || student.user.status !== "ACTIVE" || student.departmentId !== session.batch.departmentId || student.user.universityId !== session.batch.department.universityId) {
      throw new AuthError("Batch not found.", 404);
    }
    const membership = await prisma.studentBatch.findFirst({
      where: {
        studentId: actor.sub,
        batchId: session.batchId,
        ...sessionMembershipEligibility(session),
        student: { departmentId: session.batch.departmentId, user: { universityId: session.batch.department.universityId, status: "ACTIVE" } },
      },
      select: { studentId: true },
    });
    if (!membership) throw new AuthError("Session not found.", 404);

    const attendanceRecord = await prisma.attendanceRecord.findUnique({
      where: { sessionId_studentId: { sessionId, studentId: actor.sub } },
      select: { status: true, finalizedAt: true },
    });

    return { session, attendanceRecord };
  }

  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    include: {
      batch: {
        include: {
          department: true,
        },
      },
      mentor: { select: { id: true, universityIdNumber: true, email: true } },
      attendanceRecords: {
        include: {
          student: {
            include: { user: true },
          },
          edits: {
            include: {
              changedBy: { select: { universityIdNumber: true, email: true } },
            },
            orderBy: { changedAt: "desc" },
          },
        },
      },
    },
  });

  if (!session) throw new AuthError("Session not found.", 404);

  // Check batch authorization
  await requireMentorOwnsBatch(actor, session.batchId);

  // Fetch active students in the batch at session time
  const batchStudents = await prisma.studentBatch.findMany({
    where: {
      batchId: session.batchId,
      ...sessionMembershipEligibility(session),
    },
    include: {
      student: {
        include: { user: true },
      },
    },
  });

  return {
    session,
    batchStudents: batchStudents.map((sb) => sb.student),
  };
}

export async function saveAttendance(
  actor: AccessTokenPayload,
  sessionId: string,
  input: SaveAttendanceInput
) {
  const session = await prisma.attendanceSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new AuthError("Session not found.", 404);

  await requireMentorOwnsBatch(actor, session.batchId);
  if (session.status !== "SCHEDULED") {
    throw new AuthError("Attendance can only be saved for scheduled sessions.", 400);
  }

  const submittedStudentIds = new Set(input.records.map((record) => record.studentId));
  if (submittedStudentIds.size !== input.records.length) {
    throw new AuthError("Attendance records must not contain duplicate students.", 400);
  }

  const now = new Date();
  const finalizedAt = input.finalize ? now : null;

  // Process each attendance record item
  const results = await prisma.$transaction(async (tx) => {
    const currentSession = await tx.attendanceSession.findUnique({
      where: { id: sessionId },
      select: { status: true, date: true, startTime: true },
    });
    if (!currentSession || currentSession.status !== "SCHEDULED") {
      throw new AuthError("Attendance can only be saved for scheduled sessions.", 400);
    }

    const activeStudents = await tx.studentBatch.findMany({
      where: {
        batchId: session.batchId,
        ...sessionMembershipEligibility(currentSession),
      },
      select: { studentId: true },
    });
    const activeStudentIds = new Set(activeStudents.map((student) => student.studentId));
    if ([...submittedStudentIds].some((studentId) => !activeStudentIds.has(studentId))) {
      throw new AuthError("Attendance can only be recorded for active students in this batch.", 400);
    }
    if (
      input.finalize &&
      (activeStudentIds.size === 0 ||
        submittedStudentIds.size !== activeStudentIds.size ||
        [...activeStudentIds].some((studentId) => !submittedStudentIds.has(studentId)))
    ) {
      throw new AuthError("Attendance must include every active batch student before finalization.", 400);
    }

    const updatedRecords = [];

    for (const recordItem of input.records) {
      const existing = await tx.attendanceRecord.findUnique({
        where: { sessionId_studentId: { sessionId, studentId: recordItem.studentId } },
      });

      if (existing) {
        if (existing.finalizedAt && existing.status !== recordItem.status) {
          throw new AuthError(
            `Attendance for student ${recordItem.studentId} is already finalized. Use the correction feature with reason to update.`,
            403
          );
        }
        if (existing.finalizedAt) {
          updatedRecords.push(existing);
          continue;
        }

        const updated = await tx.attendanceRecord.update({
          where: { id: existing.id },
          data: {
            status: recordItem.status,
            finalizedAt: input.finalize ? (existing.finalizedAt ?? now) : existing.finalizedAt,
          },
        });
        updatedRecords.push(updated);
      } else {
        const created = await tx.attendanceRecord.create({
          data: {
            sessionId,
            studentId: recordItem.studentId,
            status: recordItem.status,
            finalizedAt,
          },
        });
        updatedRecords.push(created);
      }
    }

    if (input.finalize) {
      await tx.attendanceSession.update({
        where: { id: sessionId },
        data: { status: "COMPLETED" },
      });
    }

    return updatedRecords;
  });

  await writeAuditLog({
    actorId: actor.sub,
    actorRole: actor.role,
    action: input.finalize ? "ATTENDANCE_FINALIZED" : "ATTENDANCE_DRAFT_SAVED",
    targetType: "AttendanceSession",
    targetId: sessionId,
    newValue: { recordCount: input.records.length, finalized: input.finalize },
  });

  return results;
}

export async function editFinalizedAttendanceRecord(
  actor: AccessTokenPayload,
  attendanceRecordId: string,
  input: EditFinalizedAttendanceInput
) {
  const record = await prisma.attendanceRecord.findUnique({
    where: { id: attendanceRecordId },
    include: { session: true },
  });

  if (!record) throw new AuthError("Attendance record not found.", 404);

  await requireMentorOwnsBatch(actor, record.session.batchId);

  if (!record.finalizedAt) {
    throw new AuthError("This attendance record is not finalized yet. Save draft or finalize first.", 400);
  }

  if (record.status === input.newStatus) {
    throw new AuthError("New status is identical to current status.", 400);
  }

  const previousStatus = record.status;
  const now = new Date();

  const [updatedRecord, editLog] = await prisma.$transaction([
    prisma.attendanceRecord.update({
      where: { id: attendanceRecordId },
      data: { status: input.newStatus },
    }),
    prisma.attendanceEditLog.create({
      data: {
        attendanceRecordId,
        changedById: actor.sub,
        previousStatus,
        newStatus: input.newStatus,
        reason: input.reason.trim(),
        changedAt: now,
      },
    }),
  ]);

  await writeAuditLog({
    actorId: actor.sub,
    actorRole: actor.role,
    action: "ATTENDANCE_EDITED_AFTER_FINALIZATION",
    targetType: "AttendanceRecord",
    targetId: attendanceRecordId,
    previousValue: { status: previousStatus },
    newValue: { status: input.newStatus },
    reason: input.reason.trim(),
  });

  return { updatedRecord, editLog };
}
