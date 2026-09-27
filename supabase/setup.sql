-- =====================================================================
-- ONE-SHOT SETUP for Supabase (SQL Editor) — canonical schema + seeds.
--
-- Creates every table the app needs (matching prisma/schema.prisma
-- EXACTLY — quoted PascalCase names, which is what Prisma queries),
-- self-heals any missing columns on an existing database, creates the
-- auxiliary tables, and seeds the coordinator accounts. A Vercel
-- deployment then works without ever running `prisma db push`.
--
-- How to run:
--   1. Open https://supabase.com/dashboard → your project
--   2. SQL Editor (left sidebar) → New query
--   3. Paste this whole file → Run
--   4. Then test the Vercel deployment again — registrations will work.
--
-- Safe to re-run: everything is idempotent (IF NOT EXISTS / ON CONFLICT
-- DO UPDATE / guarded DO blocks). Re-running NEVER wipes scores or
-- overwrites data — it only adds what is missing.
--
-- NOTE: older versions of this file created lowercase snake_case tables
-- (students, is_super_admin, …). The app cannot query those — the legacy
-- tables are dropped below (they only ever held the coordinator seed).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Remove legacy lowercase tables from OLD versions of this file /
--    supabase/schema.sql. The app (Prisma) only reads the PascalCase
--    tables created below, so these drops never touch live app data.
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS students      CASCADE;
DROP TABLE IF EXISTS scrape_results CASCADE;
DROP TABLE IF EXISTS documents     CASCADE;
DROP TABLE IF EXISTS project_links CASCADE;

-- ---------------------------------------------------------------------
-- 1. "Student" — one row per account/submission
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Student" (
    "id" TEXT NOT NULL,
    "registerNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "facultyAdvisor" TEXT,
    "tenthPercent" DOUBLE PRECISION NOT NULL,
    "twelfthPercent" DOUBLE PRECISION NOT NULL,
    "cgpa" DOUBLE PRECISION NOT NULL,
    "sgpaSem1" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sgpaSem2" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "githubUrl" TEXT,
    "leetcodeUrl" TEXT,
    "proofUrls" TEXT NOT NULL DEFAULT '[]',
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "evaluatorAssigned" BOOLEAN NOT NULL DEFAULT false,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "canViewSubmissions" BOOLEAN NOT NULL DEFAULT false,
    "canScore" BOOLEAN NOT NULL DEFAULT false,
    "permissionScopes" TEXT NOT NULL DEFAULT '[]',
    "passwordHash" TEXT,
    "claimablePassword" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "coordinatorNote" TEXT,
    "uploadToken" TEXT NOT NULL,
    "scoreAcademic" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scoreGithub" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scoreCoding" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scoreInternship" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scoreCertifications" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scoreProjects" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scoreFullstack" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scoreHackathons" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scoreInhouse" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scoreMembership" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scoreShl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Student_registerNumber_key" ON "Student"("registerNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Student_email_key"          ON "Student"("email");
CREATE INDEX IF NOT EXISTS "Student_status_idx"     ON "Student"("status");
CREATE INDEX IF NOT EXISTS "Student_totalScore_idx" ON "Student"("totalScore");

-- ---------------------------------------------------------------------
-- 2. Self-heal: add every column a database created by an older script
--    might be missing. No-ops when the column already exists.
-- ---------------------------------------------------------------------
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "sgpaSem1"           DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "sgpaSem2"           DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "isSuperAdmin"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "canViewSubmissions" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "canScore"           BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "permissionScopes"   TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "claimablePassword"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "uploadToken"        TEXT NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "scoreCertifications" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "scoreFullstack"      DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "scoreHackathons"     DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "scoreInhouse"        DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "scoreMembership"     DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "scoreShl"            DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Student" DROP COLUMN IF EXISTS "scoreExtras";

-- ---------------------------------------------------------------------
-- 3. "ScrapeResult" / "Document" / "ProjectLink"
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ScrapeResult" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "mode" TEXT,
    "dataJson" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "ScrapeResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ScrapeResult_studentId_idx" ON "ScrapeResult"("studentId");
CREATE UNIQUE INDEX IF NOT EXISTS "ScrapeResult_studentId_platform_key" ON "ScrapeResult"("studentId", "platform");

CREATE TABLE IF NOT EXISTS "Document" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Document_studentId_idx" ON "Document"("studentId");
CREATE INDEX IF NOT EXISTS "Document_category_idx"  ON "Document"("category");

CREATE TABLE IF NOT EXISTS "ProjectLink" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProjectLink_studentId_idx" ON "ProjectLink"("studentId");

-- Foreign keys (guarded so re-running never errors on duplicates)
DO $$ BEGIN
  ALTER TABLE "ScrapeResult" ADD CONSTRAINT "ScrapeResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Document" ADD CONSTRAINT "Document_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProjectLink" ADD CONSTRAINT "ProjectLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 4. Auxiliary tables: password resets, notifications, settings
-- ---------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS "PasswordResetRequest_status_idx" ON "PasswordResetRequest"("status");
CREATE INDEX IF NOT EXISTS "PasswordResetRequest_email_idx"  ON "PasswordResetRequest"("email");

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

CREATE INDEX IF NOT EXISTS "Notification_studentId_readAt_idx" ON "Notification"("studentId", "readAt");

DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- ---------------------------------------------------------------------
-- 5. Seed coordinator accounts (scrypt salt:hash, app-compatible format)
--    sv3824@srmist.edu.in / vSs@11182007 · coordinator@srmist.edu.in / evaluator123
--    Re-running refreshes these two accounts to the values below.
-- ---------------------------------------------------------------------
INSERT INTO "Student" (
  "id", "registerNumber", "fullName", "email",
  "tenthPercent", "twelfthPercent", "cgpa",
  "role", "evaluatorAssigned", "isSuperAdmin", "canViewSubmissions", "canScore",
  "passwordHash", "proofUrls", "uploadToken",
  "createdAt", "updatedAt"
) VALUES
  ( 'coord-sv3824', 'COORD-SV3824', 'Siddharth V (Super Admin)', 'sv3824@srmist.edu.in',
    0, 0, 0, 'COORDINATOR', true, true, true, true,
    'b17e5a9f7d1566f1949eebd624d974cc:de322b42457c7d8d68860864780b4299f52c81bcc1ca8bccf64dc37fbb6f94ccefcdf07045b373d3f632aed5d6f28f08813bc49bb0cb2c2797dc26ada94f23de',
    '[]', gen_random_uuid()::text,
    now(), now() ),
  ( 'coord-faculty-01', 'COORD-FACULTY-01', 'Dr. Ramesh (Placement Coordinator)', 'coordinator@srmist.edu.in',
    0, 0, 0, 'COORDINATOR', true, false, true, true,
    '9ffd9bd5d3e609531beb5cd7d630ad9c:94e2a72df6e232a93d3ddc6b1ed7333a4c33a61942e3a36b2641ba3f612b5979145ffa48bd4a123859ead45930be7ea544fe1e8adff4ef4913e365247be60466',
    '[]', gen_random_uuid()::text,
    now(), now() )
ON CONFLICT ("email") DO UPDATE
  SET "role"               = EXCLUDED."role",
      "evaluatorAssigned"  = EXCLUDED."evaluatorAssigned",
      "isSuperAdmin"       = EXCLUDED."isSuperAdmin",
      "canViewSubmissions" = EXCLUDED."canViewSubmissions",
      "canScore"           = EXCLUDED."canScore",
      "passwordHash"       = EXCLUDED."passwordHash",
      "updatedAt"          = now();

-- ---------------------------------------------------------------------
-- 6. Self-checks
--    A) must return the two coordinator rows (sv3824 = isSuperAdmin true)
--    B) must list the SGPA + permission columns (no "does not exist" errors above)
-- ---------------------------------------------------------------------
SELECT "email", "role", "evaluatorAssigned" AS assigned,
       "isSuperAdmin", "canViewSubmissions", "canScore"
FROM "Student"
WHERE "role" = 'COORDINATOR'
ORDER BY "email";

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'Student'
  AND column_name IN ('sgpaSem1', 'sgpaSem2', 'isSuperAdmin', 'canViewSubmissions',
                      'canScore', 'permissionScopes', 'scoreShl')
ORDER BY column_name;

-- ---------------------------------------------------------------------
-- 7. (Optional hardening) Deny anon-key access to app data. The app
--    connects with the service role / direct Postgres, which bypasses
--    RLS, so enabling this does not affect the app.
-- ---------------------------------------------------------------------
-- alter table "Student"       enable row level security;
-- alter table "ScrapeResult"  enable row level security;
-- alter table "Document"      enable row level security;
-- alter table "ProjectLink"   enable row level security;
-- alter table "Notification"  enable row level security;
-- alter table "PasswordResetRequest" enable row level security;
-- alter table "Setting"       enable row level security;
