ALTER TABLE "users"
ADD COLUMN "is_registered" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "users_alt_email_key" ON "users"("alt_email");
