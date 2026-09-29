import { prisma } from "@/lib/prisma";
import type { Role, Prisma } from "@prisma/client";

interface AuditLogInput {
  actorId: string | null;
  actorRole: Role | null;
  action: string;
  targetType: string;
  targetId: string;
  previousValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  reason?: string;
}

/**
 * Every sensitive mutation (mentor approval/rejection, and later
 * attendance edits, student changes, etc.) records one row here. Route
 * handlers/services call this instead of writing to `audit_logs`
 * directly, so the shape of an audit entry stays consistent everywhere.
 */
export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      previousValue: input.previousValue,
      newValue: input.newValue,
      reason: input.reason,
    },
  });
}
