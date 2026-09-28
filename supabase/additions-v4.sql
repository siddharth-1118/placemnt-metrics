-- =====================================================================
-- ADDITIONS (v4) — paste this WHOLE file into Supabase → SQL Editor → Run.
--
-- Super-admin manual overrides for the three auto-calculated score
-- components (academic / GitHub / LeetCode). When a flag is true, that
-- score survives re-scrapes and the "Recalculate scores" backfill until
-- the super admin clears it (Reset to auto-calculated in the modal).
--
-- Safe to re-run; re-running NEVER touches existing scores.
-- =====================================================================

ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "academicOverridden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "githubOverridden"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "codingOverridden"   BOOLEAN NOT NULL DEFAULT false;

-- Self-check: must list 3 rows, all with default false.
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'Student'
  AND column_name IN ('academicOverridden', 'githubOverridden', 'codingOverridden')
ORDER BY column_name;
