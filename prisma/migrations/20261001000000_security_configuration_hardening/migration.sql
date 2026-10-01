ALTER TABLE "users"
ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "security_rate_limits" (
    "key" VARCHAR(64) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "window_started_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "security_rate_limits_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "security_rate_limits_window_started_at_idx"
ON "security_rate_limits"("window_started_at");
