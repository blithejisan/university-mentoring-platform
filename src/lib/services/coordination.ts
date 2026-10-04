import { randomUUID } from "node:crypto";
import type { CoordinationSupportStatus } from "@prisma/client";
import { AuthError, requireApprovedMentor, requireModeratorOwnsDepartment } from "@/lib/auth/guards";
import type { AccessTokenPayload } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";
import type {
  CreateCoordinationNoticeInput,
  CreateCoordinationSupportNoteInput,
} from "@/lib/validation/coordination";
import { createUserNotifications } from "@/lib/services/notification";
import { pusherServer } from "@/lib/pusher-server";

async function getCoordinationScope(actor: AccessTokenPayload) {
  if (actor.role !== "MENTOR" && actor.role !== "MODERATOR") {
    throw new AuthError("Not authorized to access the coordination hub.", 403);
  }

  if (actor.role === "MENTOR") await requireApprovedMentor(actor);

  const profile = actor.role === "MENTOR"
    ? await prisma.mentorProfile.findUnique({
        where: { userId: actor.sub },
        select: { departmentId: true },
      })
    : await prisma.moderatorProfile.findUnique({
        where: { userId: actor.sub },
        select: { departmentId: true },
      });
  if (!profile) throw new AuthError("Coordination profile not found.", 403);

  let universityId: string;
  if (actor.role === "MODERATOR") {
    await requireModeratorOwnsDepartment(actor, profile.departmentId);
    const user = await prisma.user.findUnique({
      where: { id: actor.sub },
      select: { universityId: true },
    });
    if (!user) throw new AuthError("Moderator account not found.", 404);
    universityId = user.universityId;
  } else {
    const [user, department] = await Promise.all([
      prisma.user.findUnique({ where: { id: actor.sub }, select: { universityId: true } }),
      prisma.department.findUnique({
        where: { id: profile.departmentId },
        select: { universityId: true },
      }),
    ]);
    if (!user || !department || user.universityId !== department.universityId) {
      throw new AuthError("Mentor profile is outside your university.", 403);
    }
    universityId = user.universityId;
  }

  const batches = actor.role === "MENTOR"
    ? await prisma.batch.findMany({
        where: {
          departmentId: profile.departmentId,
          mentorBatches: { some: { mentorId: actor.sub } },
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : await prisma.batch.findMany({
        where: { departmentId: profile.departmentId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });

  const departmentModerators = await prisma.user.findMany({
    where: {
      role: "MODERATOR",
      universityId,
      moderatorProfile: { is: { departmentId: profile.departmentId } },
    },
    select: { id: true },
  });

  return {
    departmentId: profile.departmentId,
    universityId,
    batchIds: batches.map(({ id }) => id),
    batches,
    departmentModeratorIds: departmentModerators.map(({ id }) => id),
  };
}

async function requireScopedSupportNote(actor: AccessTokenPayload, id: string) {
  const scope = await getCoordinationScope(actor);
  const note = await prisma.coordinationSupportNote.findFirst({
    where: { id, batchId: { in: scope.batchIds } },
    include: {
      batch: {
        select: {
          id: true,
          name: true,
          departmentId: true,
          department: { select: { universityId: true } },
        },
      },
      createdBy: { select: { id: true, name: true } },
      comments: { select: { authorId: true } },
    },
  });
  if (!note) throw new AuthError("Support note not found.", 404);
  return note;
}

async function notifyCoordinationUsers(
  userIds: string[],
  note: { id: string; batchId: string },
  event: { title: string; message: string; sourceKey: string }
) {
  if (userIds.length === 0) return;
  try {
    const users = await prisma.user.findMany({
      where: {
        id: { in: Array.from(new Set(userIds)) },
        role: { in: ["MENTOR", "MODERATOR"] },
        status: "ACTIVE",
      },
      select: { id: true, role: true },
    });
    await Promise.all(
      (["MENTOR", "MODERATOR"] as const).map((role) =>
        createUserNotifications(
          users.filter((user) => user.role === role).map(({ id }) => id),
          {
            type: "COORDINATION",
            title: event.title,
            message: event.message,
            href: `/${role.toLowerCase()}/coordination?noteId=${encodeURIComponent(note.id)}`,
            sourceKey: event.sourceKey,
            supportNoteId: note.id,
          },
          "inAppCoordination"
        )
      )
    );
  } catch (error) {
    console.error(`[coordination-notification] Failed to notify support note ${note.id}.`, error);
  }
}

async function getBatchCoordinationParticipants(batchId: string) {
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: {
      departmentId: true,
      department: { select: { universityId: true } },
    },
  });
  if (!batch) throw new AuthError("Batch not found.", 404);
  const [mentors, moderators] = await Promise.all([
    prisma.mentorBatch.findMany({
      where: {
        batchId,
        mentor: {
          departmentId: batch.departmentId,
          approvalStatus: "APPROVED",
          user: { is: { status: "ACTIVE", universityId: batch.department.universityId } },
        },
      },
      select: { mentorId: true },
    }),
    prisma.moderatorProfile.findMany({
      where: {
        departmentId: batch.departmentId,
        user: { is: { status: "ACTIVE", universityId: batch.department.universityId } },
      },
      select: { userId: true },
    }),
  ]);
  return [...mentors.map(({ mentorId }) => mentorId), ...moderators.map(({ userId }) => userId)];
}

async function notifyBatchCoordinationParticipants(
  batchId: string,
  actorId: string,
  note: { id: string; batchId: string },
  event: { title: string; message: string; sourceKey: string }
) {
  try {
    const participants = await getBatchCoordinationParticipants(batchId);
    await notifyCoordinationUsers(
      participants.filter((userId) => userId !== actorId),
      note,
      event
    );
  } catch (error) {
    console.error(`[coordination-notification] Failed to find recipients for batch ${batchId}.`, error);
  }
}

function getThreadParticipantIds(
  note: { createdById: string; comments: Array<{ authorId: string }> },
  excludeUserId: string
) {
  return Array.from(
    new Set([note.createdById, ...note.comments.map(({ authorId }) => authorId)])
  ).filter((userId) => userId !== excludeUserId);
}

export async function listCoordinationAnnouncements(actor: AccessTokenPayload) {
  const scope = await getCoordinationScope(actor);
  return prisma.coordinationNotice.findMany({
    where: {
      OR: [
        {
          targetBatchId: null,
          createdById: { in: scope.departmentModeratorIds },
        },
        { targetBatchId: { in: scope.batchIds } },
      ],
    },
    include: {
      createdBy: { select: { name: true, role: true } },
      targetBatch: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createCoordinationAnnouncement(
  actor: AccessTokenPayload,
  input: CreateCoordinationNoticeInput
) {
  if (actor.role !== "MODERATOR") {
    throw new AuthError("Only moderators can publish announcements.", 403);
  }
  const scope = await getCoordinationScope(actor);
  const targetBatchId = input.targetBatchId ?? null;
  if (targetBatchId) {
    const batch = await prisma.batch.findUnique({
      where: { id: targetBatchId },
      select: { id: true },
    });
    if (!batch) throw new AuthError("Batch not found.", 404);
    if (!scope.batchIds.includes(targetBatchId)) {
      throw new AuthError("You are not authorized to publish to this batch.", 403);
    }
  }

  return prisma.coordinationNotice.create({
    data: {
      title: input.title,
      content: input.content,
      targetBatchId,
      createdById: actor.sub,
    },
    include: {
      createdBy: { select: { name: true, role: true } },
      targetBatch: { select: { id: true, name: true } },
    },
  });
}

export async function listCoordinationSupportNotes(actor: AccessTokenPayload) {
  const scope = await getCoordinationScope(actor);
  const supportNotes = await prisma.coordinationSupportNote.findMany({
    where: { batchId: { in: scope.batchIds } },
    include: {
      batch: { select: { id: true, name: true } },
      student: {
        select: {
          departmentId: true,
          user: { select: { name: true, universityId: true } },
        },
      },
      createdBy: { select: { name: true, role: true } },
      _count: { select: { comments: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return {
    supportNotes: supportNotes.map((note) => ({
      ...note,
      canDelete:
        actor.role === "MODERATOR" ||
        actor.role === "ADMIN" ||
        note.createdById === actor.sub,
      student:
        note.student?.departmentId === scope.departmentId &&
        note.student.user.universityId === scope.universityId
          ? { user: { name: note.student.user.name } }
          : null,
    })),
    batches: scope.batches,
  };
}

export async function searchCoordinationStudents(
  actor: AccessTokenPayload,
  query: string
) {
  const scope = await getCoordinationScope(actor);
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2 || scope.batchIds.length === 0) return [];

  const enrollments = await prisma.studentBatch.findMany({
    where: {
      batchId: { in: scope.batchIds },
      leftAt: null,
      student: {
        user: {
          universityIdNumber: { contains: normalizedQuery, mode: "insensitive" },
        },
      },
    },
    select: {
      batchId: true,
      studentId: true,
      batch: { select: { id: true, name: true } },
      student: {
        select: {
          user: {
            select: {
              name: true,
              universityIdNumber: true,
            },
          },
        },
      },
    },
    orderBy: [
      { student: { user: { name: "asc" } } },
      { batch: { name: "asc" } },
    ],
  });
  return enrollments.map(({ batchId, studentId, batch, student }) => ({
    id: studentId,
    batchId,
    batchName: batch.name,
    name: student.user.name,
    universityIdNumber: student.user.universityIdNumber,
  }));
}

export async function listCoordinationBatchStudents(
  actor: AccessTokenPayload,
  batchId: string
) {
  const scope = await getCoordinationScope(actor);
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: { id: true },
  });
  if (!batch) throw new AuthError("Batch not found.", 404);
  if (!scope.batchIds.includes(batchId)) {
    throw new AuthError("You are not authorized to access this batch.", 403);
  }

  const enrollments = await prisma.studentBatch.findMany({
    where: { batchId, leftAt: null },
    select: {
      batchId: true,
      studentId: true,
      batch: { select: { name: true } },
      student: {
        select: {
          user: {
            select: {
              name: true,
              universityIdNumber: true,
            },
          },
        },
      },
    },
    orderBy: { student: { user: { name: "asc" } } },
  });

  return enrollments.map(({ batchId: enrolledBatchId, studentId, batch: enrolledBatch, student }) => ({
    id: studentId,
    batchId: enrolledBatchId,
    batchName: enrolledBatch.name,
    name: student.user.name,
    universityIdNumber: student.user.universityIdNumber,
  }));
}

export async function createCoordinationSupportNote(
  actor: AccessTokenPayload,
  input: CreateCoordinationSupportNoteInput
) {
  const scope = await getCoordinationScope(actor);
  const batch = await prisma.batch.findUnique({
    where: { id: input.batchId },
    select: { id: true },
  });
  if (!batch) throw new AuthError("Batch not found.", 404);
  if (!scope.batchIds.includes(input.batchId)) {
    throw new AuthError("You are not authorized to post in this batch.", 403);
  }
  if (input.studentId) {
    const enrollment = await prisma.studentBatch.findFirst({
      where: {
        studentId: input.studentId,
        batchId: input.batchId,
        leftAt: null,
      },
      select: { studentId: true },
    });
    if (!enrollment) throw new AuthError("Student is not currently enrolled in this batch.", 400);
  }

  const supportNote = await prisma.coordinationSupportNote.create({
    data: {
      batchId: input.batchId,
      studentId: input.studentId ?? null,
      title: input.title,
      message: input.message,
      createdById: actor.sub,
    },
    include: {
      batch: { select: { id: true, name: true } },
      student: { select: { user: { select: { name: true } } } },
      createdBy: { select: { id: true, name: true, role: true } },
      _count: { select: { comments: true } },
    },
  });
  await notifyBatchCoordinationParticipants(
    input.batchId,
    actor.sub,
    { id: supportNote.id, batchId: supportNote.batchId },
    {
      title: `New support note in ${supportNote.batch.name}`,
      message: `${supportNote.createdBy.name || "A colleague"} posted: ${supportNote.title}`,
      sourceKey: `coordination-note:${supportNote.id}:created`,
    }
  );
  try {
    if (pusherServer) {
      await pusherServer.trigger(`private-note-${supportNote.id}`, "note:updated", supportNote);
    }
  } catch (error) {
    console.error(`[coordination-pusher] Failed to publish support note ${supportNote.id}.`, error);
  }
  return { ...supportNote, canDelete: true };
}

export async function listCoordinationComments(actor: AccessTokenPayload, noteId: string) {
  const note = await requireScopedSupportNote(actor, noteId);
  return prisma.coordinationComment.findMany({
    where: { supportNoteId: note.id },
    include: { author: { select: { name: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function authorizeCoordinationNoteChannel(
  actor: AccessTokenPayload,
  noteId: string
) {
  await requireScopedSupportNote(actor, noteId);
}

export async function createCoordinationComment(
  actor: AccessTokenPayload,
  noteId: string,
  content: string
) {
  const note = await requireScopedSupportNote(actor, noteId);
  const comment = await prisma.coordinationComment.create({
    data: { supportNoteId: note.id, authorId: actor.sub, content },
    include: { author: { select: { name: true, role: true } } },
  });
  try {
    if (pusherServer) {
      await pusherServer.trigger(`private-note-${note.id}`, "comment:new", comment);
    }
  } catch (error) {
    console.error(`[coordination-pusher] Failed to publish comment ${comment.id}.`, error);
  }
  await notifyCoordinationUsers(
    getThreadParticipantIds(note, actor.sub),
    note,
    {
      title: "New reply in support thread",
      message: `${comment.author.name || "A colleague"} replied to: ${note.title}`,
      sourceKey: `coordination-comment:${comment.id}`,
    }
  );
  return comment;
}

export async function updateCoordinationSupportStatus(
  actor: AccessTokenPayload,
  noteId: string,
  status: CoordinationSupportStatus
) {
  const note = await requireScopedSupportNote(actor, noteId);
  if (note.status === status) {
    return { id: note.id, status: note.status, updatedAt: note.updatedAt };
  }
  const updated = await prisma.coordinationSupportNote.update({
    where: { id: note.id },
    data: { status },
    select: { id: true, status: true, updatedAt: true },
  });
  try {
    if (pusherServer) {
      await pusherServer.trigger(`private-note-${note.id}`, "note:updated", updated);
    }
  } catch (error) {
    console.error(`[coordination-pusher] Failed to publish support note ${note.id}.`, error);
  }
  await notifyCoordinationUsers(
    getThreadParticipantIds(note, actor.sub),
    note,
    {
      title: `Support note ${status === "RESOLVED" ? "resolved" : "reopened"}`,
      message: `${actor.role === "MENTOR" ? "A mentor" : "A moderator"} updated: ${note.title}`,
      sourceKey: `coordination-status:${note.id}:${randomUUID()}`,
    }
  );
  return updated;
}

export async function deleteCoordinationSupportNote(
  actor: AccessTokenPayload,
  noteId: string
) {
  if (actor.role !== "ADMIN" && actor.role !== "MENTOR" && actor.role !== "MODERATOR") {
    throw new AuthError("Not authorized to delete support notes.", 403);
  }

  const note = await prisma.coordinationSupportNote.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      createdById: true,
      batchId: true,
      batch: { select: { department: { select: { universityId: true } } } },
    },
  });
  if (!note) throw new AuthError("Support note not found.", 404);

  if (actor.role === "MENTOR") {
    const scope = await getCoordinationScope(actor);
    if (!scope.batchIds.includes(note.batchId)) {
      throw new AuthError("Not authorized to delete support notes outside your batches.", 403);
    }
    if (note.createdById !== actor.sub) {
      throw new AuthError("Only the note creator can delete this support note.", 403);
    }
  } else if (actor.role === "MODERATOR") {
    const scope = await getCoordinationScope(actor);
    if (!scope.batchIds.includes(note.batchId)) {
      throw new AuthError("Not authorized to delete support notes outside your department.", 403);
    }
  } else {
    const admin = await prisma.user.findUnique({
      where: { id: actor.sub },
      select: { universityId: true },
    });
    if (!admin || admin.universityId !== note.batch.department.universityId) {
      throw new AuthError("Not authorized to delete support notes outside your university.", 403);
    }
  }

  await prisma.coordinationSupportNote.delete({ where: { id: note.id } });
  return { id: note.id };
}
