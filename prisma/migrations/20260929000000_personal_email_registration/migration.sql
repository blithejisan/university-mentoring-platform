ALTER TABLE "users" ADD COLUMN "name" TEXT;

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");