import { prisma } from "@/lib/prisma";

/**
 * Coordinator-controlled portal settings, stored in the Setting table so they
 * survive restarts and apply to the serverless deployment too. Values are
 * JSON-encoded strings; reads fail open (locked = false) if anything is wrong.
 */

export const SUBMISSIONS_LOCKED_KEY = "submissionsLocked";

/** True when the coordinator has closed submissions portal-wide. */
export async function isSubmissionsLocked(): Promise<boolean> {
  try {
    const row = await prisma.setting.findUnique({
      where: { key: SUBMISSIONS_LOCKED_KEY },
    });
    return row?.value === "true";
  } catch {
    return false;
  }
}

export async function setSubmissionsLocked(locked: boolean): Promise<void> {
  await prisma.setting.upsert({
    where: { key: SUBMISSIONS_LOCKED_KEY },
    create: { key: SUBMISSIONS_LOCKED_KEY, value: String(locked) },
    update: { value: String(locked) },
  });
}
