import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth/guards";
import type { AccessTokenPayload } from "@/lib/auth/jwt";
import type { UpdateCRApplicationInput } from "@/lib/validation/cr";
import { writeAuditLog } from "@/lib/audit";

async function getAdminUniversityId(actor: AccessTokenPayload) {
  const admin = await prisma.user.findUnique({
    where: { id: actor.sub },
    select: { universityId: true },
  });
  if (!admin) throw new AuthError("Admin account not found.", 404);
  return admin.universityId;
}

export async function listCRApplications(
  actor: AccessTokenPayload,
  query: string
) {
  const universityId = await getAdminUniversityId(actor);
  const memberships = {
    where: { leftAt: null },
    select: { batch: { select: { id: true, name: true } } },
  } as const;

  const [pendingRequests, searchResults] = await Promise.all([
    prisma.user.findMany({
      where: {
        universityId,
        role: "STUDENT",
        crStatus: "PENDING",
        studentProfile: { isNot: null },
      },
      orderBy: { name: "asc" },
      take: 100,
      select: {
        id: true,
        name: true,
        email: true,
        universityIdNumber: true,
        status: true,
        crStatus: true,
        studentProfile: { select: { studentBatches: memberships } },
      },
    }),
    query
      ? prisma.user.findMany({
          where: {
            universityId,
            role: "STUDENT",
            studentProfile: { isNot: null },
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
  const universityId = await getAdminUniversityId(actor);
  if (input.action === "REJECT") {
    const target = await prisma.user.findFirst({
      where: {
        id: input.userId,
        universityId,
        role: "STUDENT",
        crStatus: "PENDING",
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
    where: { id: batchId, department: { universityId } },
    select: { id: true },
  });
  if (!batch) throw new AuthError("Batch not found in your university.", 404);

  const approved = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "batches" WHERE "id" = ${batchId} FOR UPDATE`;

    const target = await tx.user.findFirst({
      where: {
        id: userId,
        universityId,
        role: "STUDENT",
        status: { notIn: ["REJECTED", "SUSPENDED"] },
        studentProfile: {
          is: { studentBatches: { some: { batchId, leftAt: null } } },
        },
      },
      select: { id: true, crStatus: true, crBatchId: true, isCR: true },
    });
    if (!target) {
      throw new AuthError("A valid student assigned to the selected batch was not found.", 404);
    }

    if (target.isCR && target.crStatus === "APPROVED" && target.crBatchId === batchId) {
      return target;
    }

    const approvedCount = await tx.user.count({
      where: { crBatchId: batchId, isCR: true, crStatus: "APPROVED" },
    });
    if (approvedCount >= 3) {
      throw new AuthError("This batch already has the maximum of 3 approved CRs.", 409);
    }

    return tx.user.update({
      where: { id: target.id },
      data: {
        isCR: true,
        crStatus: "APPROVED",
        crApprovedAt: new Date(),
        crBatchId: batchId,
      },
      select: { id: true, isCR: true, crStatus: true, crBatchId: true },
    });
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
