CREATE TYPE "CRStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "users"
ADD COLUMN "is_cr" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "cr_status" "CRStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN "cr_approved_at" TIMESTAMP(3),
ADD COLUMN "cr_batch_id" TEXT;

CREATE INDEX "users_cr_batch_id_idx" ON "users"("cr_batch_id");

ALTER TABLE "users"
ADD CONSTRAINT "users_cr_batch_id_fkey"
FOREIGN KEY ("cr_batch_id") REFERENCES "batches"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "batch_notices" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "attachments" JSONB,
    "send_email_notification" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_notices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "batch_notices_batch_id_created_at_idx" ON "batch_notices"("batch_id", "created_at");
CREATE INDEX "batch_notices_batch_id_is_pinned_idx" ON "batch_notices"("batch_id", "is_pinned");

ALTER TABLE "batch_notices"
ADD CONSTRAINT "batch_notices_batch_id_fkey"
FOREIGN KEY ("batch_id") REFERENCES "batches"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "batch_notices"
ADD CONSTRAINT "batch_notices_author_id_fkey"
FOREIGN KEY ("author_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
