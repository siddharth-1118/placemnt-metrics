import { prisma } from "@/lib/prisma";

/**
 * Idempotent, non-destructive schema self-healing for the deployed database.
 *
 * The app selects the permission + per-section score columns on every session
 * resolution, so a database that predates any of these columns makes EVERY
 * page throw a Server Components error (the root layout resolves the session).
 * This runs the same statements as supabase/additions-v3.sql (minus the
 * one-time old-scale score reset, which must never re-run from a URL):
 *
 *   - adds any missing permission / scope / score columns,
 *   - creates sv3824@srmist.edu.in as super admin if the account is missing,
 *   - promotes sv3824 when the row exists (never touches the password),
 *   - expands legacy EXTRAS/PROJECTS scope keys.
 *
 * Postgres only: the local SQLite dev database is managed by `prisma db push`
 * and always matches the schema, so this helper reports "nothing to do" there.
 */

const STUDENT_ID = "coord-sv3824";
const ADMIN_EMAIL = "sv3824@srmist.edu.in";
// scrypt hash of the initial password documented in additions-v3.sql.
const INITIAL_ADMIN_HASH =
  "d45435861c517a84d8b9dee1d5f5ad7f:945c8098a6442b6b8f956e9c8c251a019c364a78f989601e516779833f8633c38a5cd802e2fb55f344d749669463a30bc18f41a1eb629a3ab20541f9e2b41d5b";

const REQUIRED_COLUMNS: { name: string; ddl: string }[] = [
  { name: "isSuperAdmin", ddl: `ALTER TABLE "Student" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false` },
  { name: "canViewSubmissions", ddl: `ALTER TABLE "Student" ADD COLUMN "canViewSubmissions" BOOLEAN NOT NULL DEFAULT false` },
  { name: "canScore", ddl: `ALTER TABLE "Student" ADD COLUMN "canScore" BOOLEAN NOT NULL DEFAULT false` },
  { name: "permissionScopes", ddl: `ALTER TABLE "Student" ADD COLUMN "permissionScopes" TEXT NOT NULL DEFAULT '[]'` },
  { name: "scoreCertifications", ddl: `ALTER TABLE "Student" ADD COLUMN "scoreCertifications" DOUBLE PRECISION NOT NULL DEFAULT 0` },
  { name: "scoreFullstack", ddl: `ALTER TABLE "Student" ADD COLUMN "scoreFullstack" DOUBLE PRECISION NOT NULL DEFAULT 0` },
  { name: "scoreHackathons", ddl: `ALTER TABLE "Student" ADD COLUMN "scoreHackathons" DOUBLE PRECISION NOT NULL DEFAULT 0` },
  { name: "scoreInhouse", ddl: `ALTER TABLE "Student" ADD COLUMN "scoreInhouse" DOUBLE PRECISION NOT NULL DEFAULT 0` },
  { name: "scoreMembership", ddl: `ALTER TABLE "Student" ADD COLUMN "scoreMembership" DOUBLE PRECISION NOT NULL DEFAULT 0` },
  { name: "scoreShl", ddl: `ALTER TABLE "Student" ADD COLUMN "scoreShl" DOUBLE PRECISION NOT NULL DEFAULT 0` },
];

export interface EnsureSchemaResult {
  ok: boolean;
  dialect: "postgresql" | "sqlite" | "unknown";
  addedColumns: string[];
  adminCreated: boolean;
  adminPromoted: number;
  scopesMigrated: number;
  error?: string;
}

function isPostgres(): boolean {
  return (process.env.DATABASE_URL ?? "").toLowerCase().startsWith("postgres");
}

export async function ensureSchema(): Promise<EnsureSchemaResult> {
  const result: EnsureSchemaResult = {
    ok: false,
    dialect: isPostgres() ? "postgresql" : "unknown",
    addedColumns: [],
    adminCreated: false,
    adminPromoted: 0,
    scopesMigrated: 0,
  };

  // Local SQLite dev DBs are schema-managed by prisma db push — never migrate.
  if (!isPostgres()) {
    result.ok = true;
    result.dialect = "sqlite";
    return result;
  }

  try {
    // 1. Which required columns are missing right now?
    const existing = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'Student'`;
    const have = new Set(existing.map((r) => r.column_name));

    // 2. Add only the missing ones (plain ADD COLUMN — no IF NOT EXISTS so a
    //    concurrent run failing on a duplicate is loud rather than silent).
    for (const col of REQUIRED_COLUMNS) {
      if (have.has(col.name)) continue;
      await prisma.$executeRawUnsafe(col.ddl);
      result.addedColumns.push(col.name);
    }

    // 3. Create the super admin when the account does not exist (INSERT only —
    //    never overwrites an existing password).
    const admins = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM "Student" WHERE "email" = ${ADMIN_EMAIL}`;
    if (Number(admins[0]?.n ?? 0) === 0) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "Student" (
           "id", "registerNumber", "fullName", "email",
           "tenthPercent", "twelfthPercent", "cgpa",
           "role", "evaluatorAssigned", "isSuperAdmin", "canViewSubmissions", "canScore",
           "passwordHash", "proofUrls", "uploadToken", "createdAt", "updatedAt"
         ) SELECT ${STUDENT_ID}, 'COORD-SV3824', 'Siddharth V (Super Admin)', ${ADMIN_EMAIL},
           0, 0, 0, 'COORDINATOR', true, true, true, true,
           ${INITIAL_ADMIN_HASH}, '[]', gen_random_uuid()::text, now(), now()
         WHERE NOT EXISTS (SELECT 1 FROM "Student" WHERE "email" = ${ADMIN_EMAIL})`
      );
      result.adminCreated = true;
    }

    // 4. Promote (idempotent; never touches passwordHash).
    result.adminPromoted = await prisma.$executeRawUnsafe(
      `UPDATE "Student"
       SET "role" = 'COORDINATOR', "isSuperAdmin" = true,
           "canViewSubmissions" = true, "canScore" = true
       WHERE "email" = ${ADMIN_EMAIL} AND NOT "isSuperAdmin"`
    );

    // 5. Expand legacy scope keys (EXTRAS → its four sections; PROJECTS gains FULLSTACK).
    result.scopesMigrated = await prisma.$executeRawUnsafe(
      `UPDATE "Student"
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
          OR ("permissionScopes"::jsonb ? 'PROJECTS' AND NOT "permissionScopes"::jsonb ? 'FULLSTACK')`
    );

    result.ok = true;
    return result;
  } catch (e) {
    result.error = (e as Error).message.slice(0, 300);
    return result;
  }
}
