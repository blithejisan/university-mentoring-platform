import { prisma } from "@/lib/prisma";
import { AuthError, requireMentorOwnsBatch } from "@/lib/auth/guards";
import type { AccessTokenPayload } from "@/lib/auth/jwt";
import type { CreateSessionInput, UpdateSessionInput, SaveAttendanceInput, EditFinalizedAttendanceInput } from "@/lib/validation/session";
import { writeAuditLog } from "@/lib/audit";

export async function createSession(actor: AccessTokenPayload, input: CreateSessionInput) {
  await requireMentorOwnsBatch(actor, input.batchId);

  let mentorId = actor.sub;
  if (actor.role === "ADMIN" || actor.role === "MODERATOR") {
    // If admin/moderator creates a session, assign to the first mentor of the batch or the actor
    const assignedMentor = await prisma.mentorBatch.findFirst({
      where: { batchId: input.batchId },
    });
    if (assignedMentor) {
      mentorId = assignedMentor.mentorId;
    }
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

  return updated;
}

export async function listSessionsForBatch(actor: AccessTokenPayload, batchId: string) {
  if (actor.role === "STUDENT") {
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
        batch: { select: { id: true, name: true } },
      },
    });

    if (!session) throw new AuthError("Session not found.", 404);

    const membership = await prisma.studentBatch.findFirst({
      where: {
        studentId: actor.sub,
        batchId: session.batchId,
        joinedAt: { lte: session.date },
        leftAt: null,
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
      joinedAt: { lte: session.date },
      OR: [{ leftAt: null }, { leftAt: { gte: session.date } }],
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
      select: { status: true, date: true },
    });
    if (!currentSession || currentSession.status !== "SCHEDULED") {
      throw new AuthError("Attendance can only be saved for scheduled sessions.", 400);
    }

    const activeStudents = await tx.studentBatch.findMany({
      where: {
        batchId: session.batchId,
        joinedAt: { lte: currentSession.date },
        OR: [{ leftAt: null }, { leftAt: { gte: currentSession.date } }],
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
