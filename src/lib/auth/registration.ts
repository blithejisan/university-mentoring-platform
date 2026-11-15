import type { User } from "@prisma/client";

type ImportedStudentCandidate = Pick<
  User,
  "role" | "isRegistered" | "status" | "emailVerifiedAt"
> & {
  studentProfile: { departmentId: string } | null;
};

export function canClaimImportedStudent(
  requestedRole: User["role"],
  existing: ImportedStudentCandidate | null,
  departmentId: string
): boolean {
  return Boolean(
    requestedRole === "STUDENT" &&
      existing?.role === "STUDENT" &&
      !existing.isRegistered &&
      existing.status === "PENDING_VERIFICATION" &&
      existing.emailVerifiedAt === null &&
      existing.studentProfile?.departmentId === departmentId
  );
}
