ALTER TYPE "EmailType" ADD VALUE 'SESSION_REMINDER';

CREATE TYPE "NotificationType" AS ENUM ('NOTICE', 'SESSION', 'REMARK');

ALTER TABLE "email_logs"
ADD COLUMN "related_session_id" TEXT,
ADD COLUMN "dedupe_key" TEXT;

CREATE UNIQUE INDEX "email_logs_dedupe_key_key" ON "email_logs"("dedupe_key");

ALTER TABLE "email_logs"
ADD CONSTRAINT "email_logs_related_session_id_fkey"
FOREIGN KEY ("related_session_id") REFERENCES "attendance_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "notice_id" TEXT,
    "session_id" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "href" TEXT,
    "source_key" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notifications_user_id_source_key_key" ON "notifications"("user_id", "source_key");
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");
CREATE INDEX "notifications_notice_id_idx" ON "notifications"("notice_id");
CREATE INDEX "notifications_session_id_idx" ON "notifications"("session_id");

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_notice_id_fkey"
FOREIGN KEY ("notice_id") REFERENCES "notices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "notification_preferences" (
    "user_id" TEXT NOT NULL,
    "in_app_notices" BOOLEAN NOT NULL DEFAULT true,
    "email_notices" BOOLEAN NOT NULL DEFAULT true,
    "in_app_sessions" BOOLEAN NOT NULL DEFAULT true,
    "email_session_reminders" BOOLEAN NOT NULL DEFAULT true,
    "in_app_remarks" BOOLEAN NOT NULL DEFAULT true,
    "email_remarks" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "notification_preferences"
ADD CONSTRAINT "notification_preferences_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
