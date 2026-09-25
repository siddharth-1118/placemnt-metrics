-- =====================================================================
-- Additions (v3) — run this ONCE in the Supabase SQL editor if your
-- database was already set up and you only want the new super-admin /
-- coordinator-permission columns (skip if you run `npm run db:use`,
-- which pushes the whole schema and seeds automatically).
--
-- Adds:
--   Student.isSuperAdmin        — full access + coordinator management
--   Student.canViewSubmissions  — may open leaderboard & inspect
--   Student.canScore            — may score & verify (implies view)
--
-- Then promotes sv3824@srmist.edu.in to super admin with all access.
-- Safe to re-run; touches nothing else.
-- =====================================================================

ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "isSuperAdmin"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "canViewSubmissions" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "canScore"           BOOLEAN NOT NULL DEFAULT false;

-- Promote the super admin (idempotent — also fixes role/evaluator flags
-- on an existing account without touching its password).
UPDATE "Student"
SET "role"               = 'COORDINATOR',
    "isSuperAdmin"       = true,
    "canViewSubmissions" = true,
    "canScore"           = true,
    "evaluatorAssigned"  = true
WHERE "email" = 'sv3824@srmist.edu.in';

-- Self-check: should return exactly 1 row with all true.
SELECT "email", "role", "isSuperAdmin", "canViewSubmissions", "canScore"
FROM "Student"
WHERE "email" = 'sv3824@srmist.edu.in';
