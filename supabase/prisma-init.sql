-- =====================================================================
-- EXACT schema Prisma expects (generated with prisma migrate diff) plus
-- seeded coordinator accounts. Table names are case-sensitive PascalCase
-- ("Student", "ScrapeResult", "Document", "ProjectLink") - this is what
-- the deployed app queries; supabase/setup.sql's lowercase names differ.
--
-- HOW TO RUN: Supabase dashboard > SQL Editor > New query > paste all > Run
-- Safe to re-run (idempotent). Drops nothing of the new tables.
-- =====================================================================

-- If you previously ran supabase/setup.sql (lowercase tables), remove them:
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS scrape_results CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS project_links CASCADE;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Student" (
    "id" TEXT NOT NULL,
    "registerNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "facultyAdvisor" TEXT,
    "tenthPercent" DOUBLE PRECISION NOT NULL,
    "twelfthPercent" DOUBLE PRECISION NOT NULL,
    "cgpa" DOUBLE PRECISION NOT NULL,
    "githubUrl" TEXT,
    "leetcodeUrl" TEXT,
    "proofUrls" TEXT NOT NULL DEFAULT '[]',
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "evaluatorAssigned" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "coordinatorNote" TEXT,
    "uploadToken" TEXT NOT NULL,
    "scoreAcademic" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scoreGithub" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scoreCoding" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scoreProjects" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scoreInternship" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scoreExtras" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Student_registerNumber_key" ON "Student"("registerNumber");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Student_email_key" ON "Student"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Student_status_idx" ON "Student"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Student_totalScore_idx" ON "Student"("totalScore");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ScrapeResult_studentId_idx" ON "ScrapeResult"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ScrapeResult_studentId_platform_key" ON "ScrapeResult"("studentId", "platform");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Document_studentId_idx" ON "Document"("studentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Document_category_idx" ON "Document"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProjectLink_studentId_idx" ON "ProjectLink"("studentId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ScrapeResult" ADD CONSTRAINT "ScrapeResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Document" ADD CONSTRAINT "Document_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ProjectLink" ADD CONSTRAINT "ProjectLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;



-- =====================================================================
-- Seed coordinator accounts (scrypt salt:hash, app-compatible format)
-- sv3824@srmist.edu.in / vSs@11182007 - coordinator@srmist.edu.in / evaluator123
-- Re-running updates the passwords to these values.
-- =====================================================================
INSERT INTO "Student" (
  "id", "registerNumber", "fullName", "email",
  "tenthPercent", "twelfthPercent", "cgpa",
  "role", "evaluatorAssigned", "passwordHash", "proofUrls", "uploadToken"
) VALUES
  ( 'coord-sv3824', 'COORD-SV3824', 'SV Coordinator', 'sv3824@srmist.edu.in',
    0, 0, 0, 'COORDINATOR', true,
    'b17e5a9f7d1566f1949eebd624d974cc:de322b42457c7d8d68860864780b4299f52c81bcc1ca8bccf64dc37fbb6f94ccefcdf07045b373d3f632aed5d6f28f08813bc49bb0cb2c2797dc26ada94f23de',
    '[]', gen_random_uuid()::text ),
  ( 'coord-faculty-01', 'COORD-FACULTY-01', 'Faculty Coordinator', 'coordinator@srmist.edu.in',
    0, 0, 0, 'COORDINATOR', true,
    '9ffd9bd5d3e609531beb5cd7d630ad9c:94e2a72df6e232a93d3ddc6b1ed7333a4c33a61942e3a36b2641ba3f612b5979145ffa48bd4a123859ead45930be7ea544fe1e8adff4ef4913e365247be60466',
    '[]', gen_random_uuid()::text )
ON CONFLICT ("email") DO UPDATE
  SET "role" = EXCLUDED."role",
      "evaluatorAssigned" = EXCLUDED."evaluatorAssigned",
      "passwordHash" = EXCLUDED."passwordHash";
