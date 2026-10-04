CREATE TYPE "CoordinationSupportStatus" AS ENUM ('OPEN', 'RESOLVED');

CREATE TABLE "coordination_notices" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "target_batch_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coordination_notices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coordination_support_notes" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "student_id" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "CoordinationSupportStatus" NOT NULL DEFAULT 'OPEN',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coordination_support_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coordination_comments" (
    "id" TEXT NOT NULL,
    "support_note_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coordination_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "coordination_notices_target_batch_id_created_at_idx"
ON "coordination_notices"("target_batch_id", "created_at");
CREATE INDEX "coordination_notices_created_by_id_created_at_idx"
ON "coordination_notices"("created_by_id", "created_at");
CREATE INDEX "coordination_support_notes_batch_id_status_created_at_idx"
ON "coordination_support_notes"("batch_id", "status", "created_at");
CREATE INDEX "coordination_support_notes_student_id_idx"
ON "coordination_support_notes"("student_id");
CREATE INDEX "coordination_support_notes_created_by_id_idx"
ON "coordination_support_notes"("created_by_id");
CREATE INDEX "coordination_comments_support_note_id_created_at_idx"
ON "coordination_comments"("support_note_id", "created_at");
CREATE INDEX "coordination_comments_author_id_idx"
ON "coordination_comments"("author_id");

ALTER TABLE "coordination_notices"
ADD CONSTRAINT "coordination_notices_target_batch_id_fkey"
FOREIGN KEY ("target_batch_id") REFERENCES "batches"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coordination_notices"
ADD CONSTRAINT "coordination_notices_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coordination_support_notes"
ADD CONSTRAINT "coordination_support_notes_batch_id_fkey"
FOREIGN KEY ("batch_id") REFERENCES "batches"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coordination_support_notes"
ADD CONSTRAINT "coordination_support_notes_student_id_fkey"
FOREIGN KEY ("student_id") REFERENCES "student_profiles"("user_id")
ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "coordination_support_notes"
ADD CONSTRAINT "coordination_support_notes_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coordination_comments"
ADD CONSTRAINT "coordination_comments_support_note_id_fkey"
FOREIGN KEY ("support_note_id") REFERENCES "coordination_support_notes"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coordination_comments"
ADD CONSTRAINT "coordination_comments_author_id_fkey"
FOREIGN KEY ("author_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
