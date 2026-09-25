-- =====================================================================
-- ADDITIONS (v3) — paste this WHOLE file into Supabase → SQL Editor → Run.
--
-- REQUIRED before/with the current app deploy. Three jobs:
--   1. Add the super-admin / per-coordinator permission columns (fixes the
--      "Could not change the setting (HTTP 500)" — the app queries these on
--      every login/API call, so a missing column crashes the route),
--   2. Add the per-coordinator section scopes column,
--   3. Migrate the legacy 'EXTRAS' scope key to the new per-section keys.
--
-- Safe to re-run; touches nothing else and never touches passwords.
-- =====================================================================

-- 1. Permission columns (super admin + view/score flags)
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "isSuperAdmin"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "canViewSubmissions" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "canScore"           BOOLEAN NOT NULL DEFAULT false;

-- 2. Per-coordinator section scopes (JSON array of strings).
--    Sections: ACADEMIC | GITHUB | CODING | PROJECTS | INTERNSHIP |
--              CERTIFICATIONS | HACKATHONS | MEMBERSHIP | SHL | INHOUSE
--    Empty array = ALL sections (full access). Managed from the super
--    admin's "Coordinator management" panel.
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "permissionScopes" TEXT NOT NULL DEFAULT '[]';

-- 3. Promote the super admin (idempotent).
UPDATE "Student"
SET "role"               = 'COORDINATOR',
    "isSuperAdmin"       = true,
    "canViewSubmissions" = true,
    "canScore"           = true
WHERE "email" = 'sv3824@srmist.edu.in';

-- 4. Migrate legacy scope keys:
--    • 'EXTRAS' bundled certs + hackathons + memberships + SHL → expand into
--      those four explicit keys.
--    • 'PROJECTS' used to cover both project and full-stack links → also
--      grant the new FULLSTACK key.
--    Coordinators already holding the new keys are left untouched.
UPDATE "Student"
SET "permissionScopes" = (
  SELECT COALESCE(jsonb_agg(DISTINCT k), '[]'::jsonb)::text
  FROM (
    SELECT jsonb_array_elements_text("permissionScopes"::jsonb) AS k
    UNION
    SELECT unnest(ARRAY['CERTIFICATIONS','HACKATHONS','MEMBERSHIP','SHL'])
    WHERE "permissionScopes"::jsonb ? 'EXTRAS'
    UNION
    SELECT 'FULLSTACK'
    WHERE "permissionScopes"::jsonb ? 'PROJECTS'
  ) expanded(k)
  WHERE k IN ('ACADEMIC','GITHUB','CODING','PROJECTS','FULLSTACK','INTERNSHIP',
              'CERTIFICATIONS','HACKATHONS','MEMBERSHIP','SHL','INHOUSE')
)
WHERE "permissionScopes"::jsonb ? 'EXTRAS'
   OR "permissionScopes"::jsonb ? 'PROJECTS';

-- 5. Self-checks.
-- A) Columns exist? → must list 4 rows.
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'Student'
  AND column_name IN ('isSuperAdmin', 'canViewSubmissions', 'canScore', 'permissionScopes')
ORDER BY column_name;

-- B) Super admin promoted? → exactly 1 row, isSuperAdmin = true.
SELECT "email", "role", "isSuperAdmin", "canViewSubmissions", "canScore", "permissionScopes"
FROM "Student"
WHERE "email" = 'sv3824@srmist.edu.in';

-- C) No legacy scope keys left → must return 0 rows.
SELECT "email", "permissionScopes"
FROM "Student"
WHERE "permissionScopes"::jsonb ? 'EXTRAS';

-- D) Old PROJECTS holders gained FULLSTACK → must return 0 rows.
SELECT "email", "permissionScopes"
FROM "Student"
WHERE "permissionScopes"::jsonb ? 'PROJECTS'
  AND NOT "permissionScopes"::jsonb ? 'FULLSTACK';
