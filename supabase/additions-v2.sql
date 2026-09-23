-- =====================================================================
-- Additions (v2) — run this ONCE in the Supabase SQL editor if your
-- database was set up with an older version of prisma-init.sql.
--
-- Adds the two tables introduced with the forgot-password and
-- notification features. Safe to re-run; touches nothing else.
-- =====================================================================

CREATE TABLE IF NOT EXISTS "PasswordResetRequest" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "registerNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'INFO',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PasswordResetRequest_status_idx" ON "PasswordResetRequest"("status");
CREATE INDEX IF NOT EXISTS "PasswordResetRequest_email_idx" ON "PasswordResetRequest"("email");
CREATE INDEX IF NOT EXISTS "Notification_studentId_readAt_idx" ON "Notification"("studentId", "readAt");

DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Self-check: should return 2 rows
SELECT 'PasswordResetRequest' AS table_name, count(*) FROM "PasswordResetRequest"
UNION ALL
SELECT 'Notification', count(*) FROM "Notification";
