ALTER TYPE "NotificationType" ADD VALUE 'COORDINATION';

ALTER TABLE "notification_preferences"
ADD COLUMN "in_app_coordination" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "notifications"
ADD COLUMN "support_note_id" TEXT;

CREATE INDEX "notifications_support_note_id_idx"
ON "notifications"("support_note_id");

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_support_note_id_fkey"
FOREIGN KEY ("support_note_id") REFERENCES "coordination_support_notes"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
