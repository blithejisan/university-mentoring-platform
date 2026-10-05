import { prisma } from "@/lib/prisma";
import { AuthError, requireModeratorOwnsDepartment } from "@/lib/auth/guards";
import type { AccessTokenPayload } from "@/lib/auth/jwt";
import type { UpdateCRApplicationInput } from "@/lib/validation/cr";
import { writeAuditLog } from "@/lib/audit";

async function getCRScope(actor: AccessTokenPayload) {
  const admin = await prisma.user.findUnique({
    where: { id: actor.sub },
    select: { universityId: true },
  });
  if (!admin) throw new AuthError("Account not found.", 404);
  if (actor.role === "ADMIN") return { universityId: admin.universityId, departmentId: null };
  if (actor.role !== "MODERATOR") throw new AuthError("Not authorized to manage CRs.", 403);
  const moderator = await prisma.moderatorProfile.findUnique({
    where: { userId: actor.sub },
    select: { departmentId: true },
  });
  if (!moderator) throw new AuthError("Moderator profile not found.", 403);
  await requireModeratorOwnsDepartment(actor, moderator.departmentId);
  return { universityId: admin.universityId, departmentId: moderator.departmentId };
}

export async function listCRApplications(
  actor: AccessTokenPayload,
  query: string
) {
  const { universityId, departmentId } = await getCRScope(actor);
  const memberships = {
    where: { leftAt: null },
    select: { batch: { select: { id: true, name: true } } },
  } as const;

  const [pendingRequests, searchResults] = await Promise.all([
    prisma.user.findMany({
      where: {
        universityId,
        role: { in: ["STUDENT", "MENTOR"] },
        crStatus: "PENDING",
        studentProfile: {
          is: { ...(departmentId ? { departmentId } : {}) },
        },
      },
      orderBy: { name: "asc" },
      take: 100,
      select: {
        id: true,
        name: true,
        email: true,
        universityIdNumber: true,
        status: true,
        role: true,
        crStatus: true,
        studentProfile: { select: { studentBatches: memberships } },
      },
    }),
    query
      ? prisma.user.findMany({
          where: {
            universityId,
            role: { in: ["STUDENT", "MENTOR"] },
            studentProfile: {
              is: { ...(departmentId ? { departmentId } : {}) },
            },
            OR: [
              { universityIdNumber: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          },
          orderBy: { name: "asc" },
          take: 30,
          select: {
            id: true,
            name: true,
            email: true,
            universityIdNumber: true,
            status: true,
            role: true,
            isCR: true,
            crStatus: true,
            crBatch: { select: { id: true, name: true } },
            studentProfile: { select: { studentBatches: memberships } },
          },
        })
      : Promise.resolve([]),
  ]);

  return {
    pendingRequests: pendingRequests.map((user) => ({
      ...user,
      batches: user.studentProfile?.studentBatches.map(({ batch }) => batch) ?? [],
      studentProfile: undefined,
    })),
    searchResults: searchResults.map((user) => ({
      ...user,
      batches: user.studentProfile?.studentBatches.map(({ batch }) => batch) ?? [],
      studentProfile: undefined,
    })),
  };
}

export async function updateCRApplication(
  actor: AccessTokenPayload,
  input: UpdateCRApplicationInput
) {
  const { universityId, departmentId } = await getCRScope(actor);
  if (input.action === "REJECT") {
    const target = await prisma.user.findFirst({
      where: {
        id: input.userId,
        universityId,
        crStatus: "PENDING",
        role: { in: ["STUDENT", "MENTOR"] },
        studentProfile: {
          is: { ...(departmentId ? { departmentId } : {}) },
        },
      },
      select: { id: true, crStatus: true },
    });
    if (!target) {
      throw new AuthError("Pending CR application was not found.", 404);
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { isCR: false, crStatus: "REJECTED", crApprovedAt: null, crBatchId: null },
      select: { id: true, crStatus: true },
    });
    await writeAuditLog({
      actorId: actor.sub,
      actorRole: actor.role,
      action: "CR_APPLICATION_REJECTED",
      targetType: "User",
      targetId: target.id,
      previousValue: { crStatus: target.crStatus },
      newValue: { crStatus: updated.crStatus },
    });
    return updated;
  }

  const { batchId, userId } = input;
  const batch = await prisma.batch.findFirst({
    where: {
      id: batchId,
      department: { universityId, ...(departmentId ? { id: departmentId } : {}) },
    },
    select: { id: true, departmentId: true },
  });
  if (!batch) throw new AuthError("Batch not found in your university.", 404);

  const approved = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "batches" WHERE "id" = ${batchId} FOR UPDATE`;

    const target = await tx.user.findFirst({
      where: {
        id: userId,
        universityId,
        role: { in: ["STUDENT", "MENTOR"] },
        status: { notIn: ["REJECTED", "SUSPENDED"] },
        studentProfile: {
          is: {
            departmentId: batch.departmentId,
            studentBatches: { some: { batchId, leftAt: null } },
          },
        },
      },
      select: { id: true, crStatus: true, crBatchId: true, isCR: true },
    });
    if (!target) {
      throw new AuthError("A valid student assigned to the selected batch was not found.", 404);
    }

    let result = target;
    if (!(target.isCR && target.crStatus === "APPROVED" && target.crBatchId === batchId)) {
      const approvedCount = await tx.user.count({
        where: { crBatchId: batchId, isCR: true, crStatus: "APPROVED" },
      });
      if (approvedCount >= 3) {
        throw new AuthError("This batch already has the maximum of 3 approved CRs.", 409);
      }

      result = await tx.user.update({
        where: { id: target.id },
        data: {
          isCR: true,
          crStatus: "APPROVED",
          crApprovedAt: new Date(),
          crBatchId: batchId,
        },
        select: { id: true, isCR: true, crStatus: true, crBatchId: true },
      });
    }
    await tx.studentProfile.update({
      where: { userId: target.id },
      data: { enrolledBatchId: batchId },
    });
    return result;
  });

  await writeAuditLog({
    actorId: actor.sub,
    actorRole: actor.role,
    action: "CR_APPLICATION_APPROVED",
    targetType: "User",
    targetId: approved.id,
    newValue: { crStatus: approved.crStatus, crBatchId: approved.crBatchId },
  });
  return approved;
}
