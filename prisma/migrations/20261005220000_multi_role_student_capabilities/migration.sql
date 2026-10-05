ALTER TABLE "student_profiles"
ADD COLUMN "enrolled_batch_id" TEXT;

INSERT INTO "student_profiles" ("user_id", "department_id")
SELECT mentor."user_id", mentor."department_id"
FROM "mentor_profiles" AS mentor
ON CONFLICT ("user_id") DO NOTHING;

UPDATE "student_profiles" AS profile
SET "enrolled_batch_id" = (
  SELECT membership."batch_id"
  FROM "student_batches" AS membership
  WHERE membership."student_id" = profile."user_id"
    AND membership."left_at" IS NULL
  ORDER BY membership."joined_at" ASC
  LIMIT 1
)
WHERE profile."enrolled_batch_id" IS NULL;

CREATE INDEX "student_profiles_enrolled_batch_id_idx"
ON "student_profiles"("enrolled_batch_id");

ALTER TABLE "student_profiles"
ADD CONSTRAINT "student_profiles_enrolled_batch_id_fkey"
FOREIGN KEY ("enrolled_batch_id") REFERENCES "batches"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notifications"
ADD COLUMN "batch_notice_id" TEXT;

CREATE INDEX "notifications_batch_notice_id_idx"
ON "notifications"("batch_notice_id");

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_batch_notice_id_fkey"
FOREIGN KEY ("batch_notice_id") REFERENCES "batch_notices"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
