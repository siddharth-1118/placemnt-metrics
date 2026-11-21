import { prisma } from "@/lib/prisma";

export type UnlockableSection =
  | "ALL"
  | "PROFILE"
  | "ACADEMIC"
  | "CODING"
  | "DOCUMENTS"
  | "PROJECT_LINKS";

export interface StudentUnlockRecord {
  studentId: string;
  sections: UnlockableSection[];
  unlockedBy: string;
  unlockedById: string;
  reason?: string;
  unlockedAt: string;
}

export const UNLOCKABLE_SECTIONS_DEF: Array<{
  key: UnlockableSection;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    key: "ALL",
    label: "Full Profile & All Sections (Complete Unlock)",
    shortLabel: "All Sections",
    description: "Grants unrestricted edit access to entire profile, academic marks, documents, and links.",
  },
  {
    key: "PROFILE",
    label: "Identity & Personal Details",
    shortLabel: "Profile & Identity",
    description: "Allows editing University Register Number, SRM Student Email, Full Name, and Faculty Advisor.",
  },
  {
    key: "ACADEMIC",
    label: "Academic Records & CGPA",
    shortLabel: "Academic Marks",
    description: "Allows editing 10th %, 12th %, Semester 1 SGPA, and Semester 2 SGPA even if previously verified.",
  },
  {
    key: "CODING",
    label: "Coding Profiles (GitHub & LeetCode)",
    shortLabel: "Coding Handles",
    description: "Allows editing GitHub profile link and LeetCode handle.",
  },
  {
    key: "DOCUMENTS",
    label: "Document Proof Uploads",
    shortLabel: "Document Proofs",
    description: "Allows re-uploading, replacing, and adding marksheets/certificates even if verified by coordinator.",
  },
  {
    key: "PROJECT_LINKS",
    label: "Project & Portfolio Links",
    shortLabel: "Project Links",
    description: "Allows adding, modifying, and deleting deployed links and repository URLs.",
  },
];

export function getUnlockedSectionLabels(sections: string[] = []): string {
  if (!sections || sections.length === 0) return "None";
  if (sections.includes("ALL")) return "Full Profile (All Sections)";
  return sections
    .map((s) => {
      const match = UNLOCKABLE_SECTIONS_DEF.find((d) => d.key === s);
      return match ? match.shortLabel : s;
    })
    .join(", ");
}

/**
 * Retrieve the current active unlock record for a student from the Setting store.
 */
export async function getStudentUnlock(studentId: string): Promise<StudentUnlockRecord | null> {
  if (!studentId) return null;
  try {
    const row = await prisma.setting.findUnique({
      where: { key: `student_unlock:${studentId}` },
    });
    if (!row?.value) return null;
    const parsed = JSON.parse(row.value) as StudentUnlockRecord;
    if (!parsed || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Check if a specific section is unlocked for a student.
 */
export async function isSectionUnlocked(
  studentId: string,
  section: UnlockableSection
): Promise<boolean> {
  const unlock = await getStudentUnlock(studentId);
  if (!unlock) return false;
  return unlock.sections.includes("ALL") || unlock.sections.includes(section);
}

/**
 * Persist an unlock record for a student.
 */
export async function setStudentUnlock(
  studentId: string,
  data: {
    sections: UnlockableSection[];
    reason?: string;
    byName: string;
    byId: string;
  }
): Promise<StudentUnlockRecord> {
  const record: StudentUnlockRecord = {
    studentId,
    sections: data.sections,
    unlockedBy: data.byName,
    unlockedById: data.byId,
    reason: data.reason?.trim() || "",
    unlockedAt: new Date().toISOString(),
  };

  await prisma.setting.upsert({
    where: { key: `student_unlock:${studentId}` },
    create: {
      key: `student_unlock:${studentId}`,
      value: JSON.stringify(record),
    },
    update: {
      value: JSON.stringify(record),
    },
  });

  return record;
}

/**
 * Revoke all unlock permissions for a student (locks all sections).
 */
export async function revokeStudentUnlock(studentId: string): Promise<void> {
  if (!studentId) return;
  try {
    await prisma.setting.delete({
      where: { key: `student_unlock:${studentId}` },
    });
  } catch {
    // If not found, ignore
  }
}

/**
 * Retrieve all student unlocks in a single query for fast dashboard rendering.
 */
export async function getAllStudentUnlocks(): Promise<Record<string, StudentUnlockRecord>> {
  try {
    const rows = await prisma.setting.findMany({
      where: {
        key: { startsWith: "student_unlock:" },
      },
    });
    const result: Record<string, StudentUnlockRecord> = {};
    for (const r of rows) {
      const studentId = r.key.replace("student_unlock:", "");
      try {
        const parsed = JSON.parse(r.value);
        if (parsed && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
          result[studentId] = parsed;
        }
      } catch {
        /* ignore corrupt records */
      }
    }
    return result;
  } catch {
    return {};
  }
}
