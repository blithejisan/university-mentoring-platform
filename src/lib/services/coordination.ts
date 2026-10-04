import type { CoordinationSupportStatus } from "@prisma/client";
import { AuthError, requireApprovedMentor, requireModeratorOwnsDepartment } from "@/lib/auth/guards";
import type { AccessTokenPayload } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";
import type {
  CreateCoordinationNoticeInput,
  CreateCoordinationSupportNoteInput,
} from "@/lib/validation/coordination";

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
    select: { id: true, batchId: true },
  });
  if (!note) throw new AuthError("Support note not found.", 404);
  return note;
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
  const [supportNotes, enrollments] = await Promise.all([
    prisma.coordinationSupportNote.findMany({
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
    }),
    prisma.studentBatch.findMany({
      where: {
        batchId: { in: scope.batchIds },
        leftAt: null,
        student: {
          departmentId: scope.departmentId,
          user: { status: "ACTIVE", universityId: scope.universityId },
        },
      },
      select: {
        batchId: true,
        studentId: true,
        student: {
          select: {
            user: { select: { name: true, universityIdNumber: true } },
          },
        },
      },
      orderBy: { student: { user: { name: "asc" } } },
    }),
  ]);
  return {
    supportNotes: supportNotes.map((note) => ({
      ...note,
      student:
        note.student?.departmentId === scope.departmentId &&
        note.student.user.universityId === scope.universityId
          ? { user: { name: note.student.user.name } }
          : null,
    })),
    batches: scope.batches,
    students: enrollments.map(({ batchId, studentId, student }) => ({
      batchId,
      id: studentId,
      name: student.user.name,
      universityIdNumber: student.user.universityIdNumber,
    })),
  };
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
        student: {
          departmentId: scope.departmentId,
          user: { status: "ACTIVE", universityId: scope.universityId },
        },
      },
      select: { studentId: true },
    });
    if (!enrollment) throw new AuthError("Student is not currently enrolled in this batch.", 400);
  }

  return prisma.coordinationSupportNote.create({
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
      createdBy: { select: { name: true, role: true } },
      _count: { select: { comments: true } },
    },
  });
}

export async function listCoordinationComments(actor: AccessTokenPayload, noteId: string) {
  const note = await requireScopedSupportNote(actor, noteId);
  return prisma.coordinationComment.findMany({
    where: { supportNoteId: note.id },
    include: { author: { select: { name: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createCoordinationComment(
  actor: AccessTokenPayload,
  noteId: string,
  content: string
) {
  const note = await requireScopedSupportNote(actor, noteId);
  return prisma.coordinationComment.create({
    data: { supportNoteId: note.id, authorId: actor.sub, content },
    include: { author: { select: { name: true, role: true } } },
  });
}

export async function updateCoordinationSupportStatus(
  actor: AccessTokenPayload,
  noteId: string,
  status: CoordinationSupportStatus
) {
  const note = await requireScopedSupportNote(actor, noteId);
  return prisma.coordinationSupportNote.update({
    where: { id: note.id },
    data: { status },
    select: { id: true, status: true, updatedAt: true },
  });
}
