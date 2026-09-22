/**
 * One-command database switcher: local SQLite ↔ remote Postgres (Supabase).
 *
 *   npm run db:use -- --check "<connection-uri>"   # test reachability only
 *   npm run db:use -- "<connection-uri>"           # switch to remote + push schema + seed
 *   npm run db:use -- --local                      # switch back to local SQLite
 *
 * Rewrites DATABASE_URL in .env and flips the Prisma provider, so the rest
 * of the app never changes.
 */
import { readFileSync, writeFileSync } from "node:fs";
import * as net from "node:net";
import { execSync } from "node:child_process";
import * as path from "node:path";

const ENV_PATH = path.resolve(process.cwd(), ".env");
const SCHEMA_PATH = path.resolve(process.cwd(), "prisma", "schema.prisma");

function parseUri(uri: string) {
  const m = uri.match(/^postgresql:\/\/([^:@]+)(?::([^@]*))?@([^:/]+):(\d+)\/(.+)$/);
  if (!m) throw new Error("Not a valid postgres:// URI");
  return { user: m[1], password: m[2] ?? "", host: m[3], port: Number(m[4]), db: m[5] };
}

function checkTcp(host: string, port: number, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = net.createConnection({ host, port });
    const done = (err?: Error) => {
      s.destroy();
      err ? reject(err) : resolve();
    };
    s.setTimeout(timeoutMs, () => done(new Error(`timeout after ${timeoutMs}ms`)));
    s.once("connect", () => done());
    s.once("error", (e) => done(e));
  });
}

function readEnv() {
  return readFileSync(ENV_PATH, "utf8");
}

function setDatabaseUrl(env: string, url: string): string {
  if (!/^DATABASE_URL=/m.test(env)) return `DATABASE_URL="${url}"\n` + env;
  return env.replace(/^DATABASE_URL="[^"]*"/m, `DATABASE_URL="${url}"`);
}

function setProvider(env: string, url: string): "sqlite" | "postgresql" {
  const provider = url.startsWith("file:") ? "sqlite" : "postgresql";
  let schema = readFileSync(SCHEMA_PATH, "utf8");
  schema = schema.replace(/provider = "(sqlite|postgresql)"/, `provider = "${provider}"`);
  writeFileSync(SCHEMA_PATH, schema);
  return provider;
}

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args[0] === "--check";
  const goLocal = args[0] === "--local";

  if (goLocal) {
    let env = setDatabaseUrl(readEnv(), "file:./dev.db");
    setProvider(env, "file:./dev.db");
    writeFileSync(ENV_PATH, env);
    console.log("→ Switched to local SQLite. Run: npx prisma db push --accept-data-loss");
    return;
  }

  const uriArg = args[checkOnly ? 1 : 0];
  if (!uriArg) {
    console.error('Usage: npm run db:use -- --check "<uri>" | npm run db:use -- "<uri>" | npm run db:use -- --local');
    process.exit(1);
  }

  const { host, port, password } = parseUri(uriArg);
  if (!password || password.startsWith("[YOUR")) {
    console.error("✗ The URI still contains the [YOUR-PASSWORD] placeholder. Replace it with the real database password.");
    process.exit(1);
  }

  console.log(`Testing TCP reachability of ${host}:${port} …`);
  try {
    await checkTcp(host, port);
    console.log(`✓ Host reachable on port ${port}`);
  } catch (e) {
    console.error(`✗ CANNOT REACH ${host}:${port} from this machine (${(e as Error).message}).`);
    console.error("  Your network blocks database ports. Try a mobile hotspot, or run this");
    console.error("  step from the machine/network where you will deploy the app.");
    process.exit(2);
  }

  if (checkOnly) {
    console.log("Connectivity OK — run without --check to perform the switch.");
    return;
  }

  let env = setDatabaseUrl(readEnv(), uriArg);
  const provider = setProvider(env, uriArg);
  writeFileSync(ENV_PATH, env);
  console.log(`✓ .env DATABASE_URL updated (provider: ${provider})`);

  console.log("→ Generating Prisma client…");
  execSync("npx prisma generate", { stdio: "inherit" });
  console.log("→ Creating tables in the remote database (prisma db push)…");
  execSync("npx prisma db push --accept-data-loss", { stdio: "inherit" });
  console.log("→ Seeding coordinator accounts…");
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });

  console.log("\nDone! Restart the dev server and the app now uses Supabase.");
  console.log("Restart: kill this dev server, then `npm run dev`");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
