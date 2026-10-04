CREATE TABLE "session_mentors" (
    "session_id" TEXT NOT NULL,
    "mentor_id" TEXT NOT NULL,

    CONSTRAINT "session_mentors_pkey" PRIMARY KEY ("session_id", "mentor_id")
);

INSERT INTO "session_mentors" ("session_id", "mentor_id")
SELECT "id", "mentor_id"
FROM "attendance_sessions";

CREATE INDEX "session_mentors_mentor_id_idx"
ON "session_mentors"("mentor_id");

ALTER TABLE "session_mentors"
ADD CONSTRAINT "session_mentors_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "session_mentors"
ADD CONSTRAINT "session_mentors_mentor_id_fkey"
FOREIGN KEY ("mentor_id") REFERENCES "mentor_profiles"("user_id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mentor_evaluations"
DROP INDEX "mentor_evaluations_student_id_session_id_key";

CREATE UNIQUE INDEX "mentor_evaluations_student_id_session_id_mentor_id_key"
ON "mentor_evaluations"("student_id", "session_id", "mentor_id");
