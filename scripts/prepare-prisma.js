/**
 * Runs before `prisma generate` (wired as a postinstall step).
 *
 * The repo ships schema.prisma with provider "sqlite" for zero-config local
 * dev. On hosts like Vercel the DATABASE_URL points at Postgres (Supabase),
 * and a SQLite-generated client cannot talk to Postgres — every query would
 * 500. This script picks the correct provider from DATABASE_URL before the
 * client is generated, so the same commit builds for both worlds.
 *
 * - postgres:// or postgresql://  → provider "postgresql"
 * - file: / unset                 → provider "sqlite"
 */
const fs = require("fs");
const path = require("path");

const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");
const url = (process.env.DATABASE_URL || "").trim();
const provider = url.startsWith("postgres") ? "postgresql" : "sqlite";

let schema = fs.readFileSync(schemaPath, "utf8");
const re = /(datasource\s+db\s*\{[\s\S]*?provider\s*=\s*")(sqlite|postgresql)(")/;
if (re.test(schema)) {
  schema = schema.replace(re, `$1${provider}$3`);
  fs.writeFileSync(schemaPath, schema);
  console.log(`[prepare-prisma] provider set to "${provider}" (DATABASE_URL ${url ? "present" : "absent"})`);
} else {
  console.warn("[prepare-prisma] could not find provider line in schema.prisma — leaving as-is");
}
