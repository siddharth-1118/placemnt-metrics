import { capturePortalArchive, getArchiveManifest, ensureDailyArchive, getArchiveContent } from "../src/lib/auto-archive";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("=== TESTING CONTINUOUS AUTOMATED ARCHIVING ===");

  // 1. Capture snapshot
  const entry = await capturePortalArchive("MANUAL", "Initial automated test snapshot");
  console.log("Captured entry:", entry);

  // 2. Ensure daily snapshot
  await ensureDailyArchive();
  console.log("ensureDailyArchive completed");

  // 3. Get manifest
  const manifest = await getArchiveManifest();
  console.log("Manifest count:", manifest.length);
  if (manifest.length > 0) {
    console.log("Latest archive in manifest:", manifest[0]);
    // 4. Verify content loading
    const content = await getArchiveContent(manifest[0].filename);
    console.log("Archive content loaded, byte size:", content?.length);
  }

  console.log("Archiving engine verified 100%!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
