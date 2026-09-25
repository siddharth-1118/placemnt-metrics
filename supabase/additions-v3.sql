-- =====================================================================
-- ADDITIONS (v3) — paste this WHOLE file into Supabase → SQL Editor → Run.
--
-- REQUIRED before/with the current app deploy. Adds the super-admin /
-- per-coordinator permission columns AND the per-coordinator section
-- scopes, then promotes sv3824@srmist.edu.in to super admin.
--
-- Fixes the "Could not change the setting (HTTP 500)" error: that 500
-- happens because the app queries "isSuperAdmin" on every login/API call
-- while the deployed database is still missing the column.
--
-- Safe to re-run; touches nothing else and never touches passwords.
-- =====================================================================

-- 1. Permission columns (super admin + view/score flags)
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "isSuperAdmin"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "canViewSubmissions" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "canScore"           BOOLEAN NOT NULL DEFAULT false;

-- 2. Per-coordinator section scopes (JSON array of strings).
--    Values: ACADEMIC | GITHUB | CODING | PROJECTS | INTERNSHIP | EXTRAS
--    Empty array = ALL sections (full access). Hackathons & competitions
--    are scored under EXTRAS. Managed from the super admin's
--    "Coordinator management" panel.
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "permissionScopes" TEXT NOT NULL DEFAULT '[]';

-- 3. Promote the super admin (idempotent).
UPDATE "Student"
SET "role"               = 'COORDINATOR',
    "isSuperAdmin"       = true,
    "canViewSubmissions" = true,
    "canScore"           = true
WHERE "email" = 'sv3824@srmist.edu.in';

-- 4. Self-checks.
-- A) Columns exist?  → must list 4 rows (the new columns).
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'Student'
  AND column_name IN ('isSuperAdmin', 'canViewSubmissions', 'canScore', 'permissionScopes')
ORDER BY column_name;

-- B) Super admin promoted? → exactly 1 row, isSuperAdmin = true.
SELECT "email", "role", "isSuperAdmin", "canViewSubmissions", "canScore", "permissionScopes"
FROM "Student"
WHERE "email" = 'sv3824@srmist.edu.in';
