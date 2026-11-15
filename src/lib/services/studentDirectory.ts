import type { Prisma } from "@prisma/client";
import { AuthError, requireApprovedMentor, requireModeratorOwnsDepartment } from "@/lib/auth/guards";
import type { AccessTokenPayload } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";

type StudentDirectoryScope = {
  universityId: string;
  departmentId?: string;
  batchIds?: string[];
};

async function getStudentDirectoryScope(actor: AccessTokenPayload): Promise<StudentDirectoryScope> {
  if (actor.role === "ADMIN") {
    const admin = await prisma.user.findUnique({
      where: { id: actor.sub },
      select: { universityId: true },
    });
    if (!admin) throw new AuthError("Admin account not found.", 404);
    return { universityId: admin.universityId };
  }

  if (actor.role === "MODERATOR") {
    const [moderator, user] = await Promise.all([
      prisma.moderatorProfile.findUnique({
        where: { userId: actor.sub },
        select: { departmentId: true },
      }),
      prisma.user.findUnique({
        where: { id: actor.sub },
        select: { universityId: true },
      }),
    ]);
    if (!moderator || !user) throw new AuthError("Moderator profile not found.", 403);
    await requireModeratorOwnsDepartment(actor, moderator.departmentId);
    return { universityId: user.universityId, departmentId: moderator.departmentId };
  }

  if (actor.role === "MENTOR") {
    await requireApprovedMentor(actor);
    const [mentor, user, assignments] = await Promise.all([
      prisma.mentorProfile.findUnique({
        where: { userId: actor.sub },
        select: {
          departmentId: true,
          department: { select: { universityId: true } },
        },
      }),
      prisma.user.findUnique({
        where: { id: actor.sub },
        select: { universityId: true },
      }),
      prisma.mentorBatch.findMany({
        where: { mentorId: actor.sub },
        select: {
          batchId: true,
          batch: {
            select: {
              departmentId: true,
              department: { select: { universityId: true } },
            },
          },
        },
      }),
    ]);
    if (!mentor || !user) throw new AuthError("Mentor profile not found.", 403);
    if (
      mentor.department.universityId !== user.universityId ||
      assignments.some(
        ({ batch }) =>
          batch.departmentId !== mentor.departmentId ||
          batch.department.universityId !== user.universityId
      )
    ) {
      throw new AuthError("Assigned batch falls outside your department.", 403);
    }
    return {
      universityId: user.universityId,
      departmentId: mentor.departmentId,
      batchIds: assignments.map(({ batchId }) => batchId),
    };
  }

  throw new AuthError("Not authorized to access student information.", 403);
}

function studentWhere(
  scope: StudentDirectoryScope,
  query?: string
): Prisma.StudentProfileWhereInput {
  return {
    archivedAt: null,
    ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
    ...(scope.batchIds
      ? {
          OR: [
            {
              studentBatches: {
                some: {
                  leftAt: null,
                  batchId: { in: scope.batchIds },
                },
              },
            },
            { enrolledBatchId: { in: scope.batchIds } },
          ],
        }
      : {}),
    user: {
      universityId: scope.universityId,
      role: "STUDENT",
      status: "ACTIVE",
      ...(query
        ? {
            OR: [
              { universityIdNumber: { contains: query, mode: "insensitive" } },
              { name: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
  };
}

const profileSelect = {
  userId: true,
  phone: true,
  enrolledBatchId: true,
  enrolledBatch: { select: { id: true, name: true } },
  user: {
    select: {
      name: true,
      universityIdNumber: true,
      email: true,
      isCR: true,
      crStatus: true,
      crBatch: { select: { id: true, name: true } },
    },
  },
  studentBatches: {
    where: { leftAt: null },
    select: {
      batchId: true,
      batch: { select: { id: true, name: true } },
    },
    orderBy: { batch: { name: "asc" } },
  },
} satisfies Prisma.StudentProfileSelect;

function toProfileCard(student: {
  userId: string;
  phone: string | null;
  enrolledBatchId: string | null;
  enrolledBatch: { id: string; name: string } | null;
  user: {
    name: string | null;
    universityIdNumber: string;
    email: string;
    isCR: boolean;
    crStatus: string;
    crBatch: { id: string; name: string } | null;
  };
  studentBatches: Array<{
    batchId: string;
    batch: { id: string; name: string };
  }>;
}, scope: StudentDirectoryScope) {
  const batches = new Map(
    student.studentBatches
      .filter(({ batchId }) => !scope.batchIds || scope.batchIds.includes(batchId))
      .map(({ batch }) => [batch.id, batch])
  );
  if (
    student.enrolledBatch &&
    (!scope.batchIds || scope.batchIds.includes(student.enrolledBatchId ?? ""))
  ) {
    batches.set(student.enrolledBatch.id, student.enrolledBatch);
  }

  return {
    id: student.userId,
    name: student.user.name,
    universityIdNumber: student.user.universityIdNumber,
    email: student.user.email,
    phone: student.phone,
    isCR: student.user.isCR,
    crStatus: student.user.crStatus,
    crBatch:
      student.user.crBatch &&
      (!scope.batchIds || scope.batchIds.includes(student.user.crBatch.id))
        ? student.user.crBatch
        : null,
    batches: Array.from(batches.values()),
  };
}

export async function searchIdentifiedStudents(actor: AccessTokenPayload, query: string) {
  const scope = await getStudentDirectoryScope(actor);
  if (scope.batchIds?.length === 0) return [];
  const students = await prisma.studentProfile.findMany({
    where: studentWhere(scope, query),
    select: profileSelect,
    orderBy: [{ user: { name: "asc" } }, { user: { universityIdNumber: "asc" } }],
    take: 50,
  });
  return students.map((student) => toProfileCard(student, scope));
}

export async function getIdentifiedStudent(actor: AccessTokenPayload, studentId: string) {
  const scope = await getStudentDirectoryScope(actor);
  const student = await prisma.studentProfile.findFirst({
    where: {
      ...studentWhere(scope),
      userId: studentId,
    },
    select: profileSelect,
  });
  if (!student) throw new AuthError("Student not found.", 404);
  return toProfileCard(student, scope);
}

export async function listMentorActiveStudents(actor: AccessTokenPayload) {
  if (actor.role !== "MENTOR") {
    throw new AuthError("Only mentors can view their active student directory.", 403);
  }
  const scope = await getStudentDirectoryScope(actor);
  if (!scope.batchIds?.length) return [];
  const batchIds = scope.batchIds;
  const students = await prisma.studentProfile.findMany({
    where: studentWhere(scope),
    select: {
      userId: true,
      user: { select: { name: true, universityIdNumber: true } },
      studentBatches: {
        where: { leftAt: null, batchId: { in: batchIds } },
        select: { batch: { select: { name: true } } },
        orderBy: { batch: { name: "asc" } },
      },
      enrolledBatchId: true,
      enrolledBatch: { select: { name: true } },
    },
    orderBy: [{ user: { name: "asc" } }, { user: { universityIdNumber: "asc" } }],
  });
  return students.map((student) => {
    const batches = new Set(student.studentBatches.map(({ batch }) => batch.name));
    if (student.enrolledBatch && batchIds.includes(student.enrolledBatchId ?? "")) {
      batches.add(student.enrolledBatch.name);
    }
    return {
      id: student.userId,
      name: student.user.name,
      universityIdNumber: student.user.universityIdNumber,
      batches: Array.from(batches),
    };
  });
}
