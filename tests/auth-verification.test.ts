import assert from "node:assert/strict";
import { test } from "node:test";
import { canClaimImportedStudent } from "../src/lib/auth/registration";
import { getVerificationResendRetryAfter } from "../src/lib/auth/tokens";

test("imported students can claim only unregistered accounts in their department", () => {
  const importedStudent = {
    role: "STUDENT",
    isRegistered: false,
    status: "PENDING_VERIFICATION",
    emailVerifiedAt: null,
    studentProfile: { departmentId: "department-1" },
  } as const;

  assert.equal(canClaimImportedStudent("STUDENT", importedStudent, "department-1"), true);
  assert.equal(canClaimImportedStudent("STUDENT", importedStudent, "department-2"), false);
  assert.equal(
    canClaimImportedStudent(
      "STUDENT",
      { ...importedStudent, isRegistered: true },
      "department-1"
    ),
    false
  );
  assert.equal(canClaimImportedStudent("MENTOR", importedStudent, "department-1"), false);
});

test("verification resend cooldown expires after five minutes", () => {
  const now = 1_000_000;
  const sentAt = new Date(now);

  assert.equal(getVerificationResendRetryAfter(null, now), null);
  assert.equal(getVerificationResendRetryAfter(sentAt, now), 300);
  assert.equal(getVerificationResendRetryAfter(sentAt, now + 299_500), 1);
  assert.equal(getVerificationResendRetryAfter(sentAt, now + 300_000), null);
});
