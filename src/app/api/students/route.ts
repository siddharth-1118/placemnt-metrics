import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enqueueScrapes } from "@/lib/pipeline";
import { clampScores, suggestAcademicScore } from "@/lib/score";
import { parseGithubLogin, parseLeetcodeUser, normalizeGithubUrl, normalizeLeetcodeUrl } from "@/lib/utils";
import { toDto } from "@/lib/dto";
import {
  requireEvaluator,
  hashPassword,
  getSessionUser,
  filterStudentDtoForUser,
} from "@/lib/auth";
import { isSubmissionsLocked } from "@/lib/settings";
import type { StudentDto } from "@/lib/types";

export const dynamic = "force-dynamic";

const proofLinkSchema = z.object({
  label: z.string().min(1).max(120),
  url: z.string().url().max(500),
});

const submitSchema = z.object({
  registerNumber: z
    .string()
    .trim()
    .min(4, "Register number is too short")
    .max(20, "Register number is too long")
    .regex(/^[A-Za-z0-9-]+$/, "Only letters, digits and hyphens allowed")
    .transform((v) => v.toUpperCase()),
  fullName: z.string().trim().min(3, "Enter your full name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(120),
  facultyAdvisor: z.string().trim().max(80).optional().or(z.literal("")),
  tenthPercent: z.coerce.number().min(0, "Must be ≥ 0").max(100, "Must be ≤ 100"),
  twelfthPercent: z.coerce.number().min(0, "Must be ≥ 0").max(100, "Must be ≤ 100"),
  /// Semester SGPAs — the CGPA is always derived as (sem1 + sem2) / 2.
  sgpaSem1: z.coerce.number().min(0, "Must be ≥ 0").max(10, "Must be ≤ 10"),
  sgpaSem2: z.coerce.number().min(0, "Must be ≥ 0").max(10, "Must be ≤ 10"),
  /// Accepted but ignored: the server recomputes CGPA from the two SGPAs so
  /// clients can never submit a CGPA that disagrees with the semester marks.
  cgpa: z.coerce.number().min(0).max(10).optional(),
  githubUrl: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || parseGithubLogin(v) !== null, "Enter a valid github.com profile link"),
  leetcodeUrl: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || parseLeetcodeUser(v) !== null, "Enter a valid leetcode.com profile link"),
  proofUrls: z.array(proofLinkSchema).max(10).optional(),
  /** Optional: lets the student view their own submission later. */
  password: z.string().min(8, "Password must be at least 8 characters").max(100).optional(),
});

/** GET /api/students — evaluator-only leaderboard (ranked, all students, lightweight & fast) */
export async function GET() {
  const { user, error } = await requireEvaluator();
  if (error) return error;

  // Return all registered student candidates from the database.
  // Pure faculty coordinator accounts (registerNumber starting with COORD-) are excluded from candidate ranking.
  // Note: scrapes is intentionally excluded from the list endpoint to avoid transferring megabytes of
  // raw GraphQL dataJson blobs. The modal fetches full scrape history individually via GET /api/students/[id].
  const students = await prisma.student.findMany({
    where: {
      NOT: {
        registerNumber: { startsWith: "COORD-" },
      },
    },
    orderBy: [{ totalScore: "desc" }, { registerNumber: "asc" }],
    include: {
      documents: {
        select: {
          id: true,
          category: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          note: true,
          status: true,
          reviewedAt: true,
          reviewNote: true,
          reviewedByName: true,
          createdAt: true,
        },
      },
      projectLinks: {
        select: {
          id: true,
          category: true,
          label: true,
          url: true,
          status: true,
          reviewedAt: true,
          reviewNote: true,
          reviewedByName: true,
          createdAt: true,
        },
      },
    },
  });
  // Scoped coordinators receive only the evidence inside their sections;
  // super admin and unrestricted coordinators get everything.
  const dtos = students.map((s) => filterStudentDtoForUser(toDto(s), user));

  // Lightweight background auto-healer: fix any student records whose CGPA or academic score is 0
  const uncalculated = students.filter(
    (s) =>
      (s.cgpa <= 0 && (s.sgpaSem1 > 0 || s.sgpaSem2 > 0)) ||
      (s.scoreAcademic <= 0 &&
        (s.tenthPercent > 0 || s.twelfthPercent > 0 || s.cgpa > 0 || s.sgpaSem1 > 0 || s.sgpaSem2 > 0))
  );
  if (uncalculated.length > 0) {
    Promise.all(
      uncalculated.map(async (st) => {
        const s1 = Number(st.sgpaSem1 || 0);
        const s2 = Number(st.sgpaSem2 || 0);
        const rawCgpa = Number(st.cgpa || 0);
        const effCgpa =
          rawCgpa > 0
            ? rawCgpa
            : s1 > 0 && s2 > 0
              ? Math.round(((s1 + s2) / 2) * 100) / 100
              : s1 > 0
                ? s1
                : s2 > 0
                  ? s2
                  : 0;
        const acadScore = suggestAcademicScore(st.tenthPercent, st.twelfthPercent, effCgpa);
        const tot = clampScores({
          academic: acadScore,
          github: st.scoreGithub,
          coding: st.scoreCoding,
          internship: st.scoreInternship,
          certifications: st.scoreCertifications,
          projects: st.scoreProjects,
          fullstack: st.scoreFullstack,
          hackathons: st.scoreHackathons,
          inhouse: st.scoreInhouse,
          membership: st.scoreMembership,
          shl: st.scoreShl,
        }).total;
        return prisma.student
          .update({
            where: { id: st.id },
            data: { cgpa: effCgpa, scoreAcademic: acadScore, totalScore: tot },
          })
          .catch(() => {});
      })
    ).catch(() => {});
  }

  return NextResponse.json(
    { students: dtos },
    {
      headers: {
        "Cache-Control": "private, no-cache, stale-while-revalidate=5",
      },
    }
  );
}

/** POST /api/students — student submission; creates or updates, then triggers scrapes */
export async function POST(req: Request) {
  try {
    // Coordinator kill-switch: when submissions are closed, nobody can submit
    // or resubmit a profile (evaluators bypass so they can still fix data).
    const user = await getSessionUser();
    const isEvaluator = user?.canViewSubmissions ?? false;
    if (!isEvaluator && (await isSubmissionsLocked())) {
      return NextResponse.json(
        { error: "Submissions are closed by the coordinator. Please contact your coordinator." },
        { status: 423 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "form";
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return NextResponse.json(
        { error: "Validation failed", fieldErrors },
        { status: 422 }
      );
    }

  const d = parsed.data;
  const proofUrls = (d.proofUrls ?? []).filter((p) => p.label && p.url);

  // CGPA is DERIVED from SGPAs (Sem 1 SGPA + Sem 2 SGPA) / 2, or fallback to single sem or direct CGPA
  const s1 = Number(d.sgpaSem1 ?? 0);
  const s2 = Number(d.sgpaSem2 ?? 0);
  const rawCgpa = Number(d.cgpa ?? 0);
  const cgpa =
    s1 > 0 && s2 > 0
      ? Math.round(((s1 + s2) / 2) * 100) / 100
      : s1 > 0
        ? s1
        : s2 > 0
          ? s2
          : rawCgpa > 0
            ? rawCgpa
            : 0;

  const data = {
    registerNumber: d.registerNumber,
    fullName: d.fullName,
    email: d.email,
    facultyAdvisor: d.facultyAdvisor || null,
    tenthPercent: d.tenthPercent,
    twelfthPercent: d.twelfthPercent,
    sgpaSem1: d.sgpaSem1,
    sgpaSem2: d.sgpaSem2,
    cgpa,
    githubUrl: normalizeGithubUrl(d.githubUrl),
    leetcodeUrl: normalizeLeetcodeUrl(d.leetcodeUrl),
    proofUrls: JSON.stringify(proofUrls),
  };

  // Session awareness: a signed-in user submitting with their OWN email
  // updates their own record (coordinators can submit as students too);
  // anonymous submissions may never touch an existing account's email.
  const session = await getSessionUser();
  const sessionIsEvaluator = !!session?.canViewSubmissions;
  let existing = await prisma.student.findUnique({ where: { registerNumber: d.registerNumber } });
  const existingByEmail = await prisma.student.findUnique({ where: { email: d.email } });

  const isOwnEmail = session !== null && session.email === d.email;
  if (
    existingByEmail &&
    existing?.id !== existingByEmail.id &&
    !isOwnEmail &&
    !(session && session.id === existingByEmail.id)
  ) {
    return NextResponse.json(
      { error: "A submission with this email already exists", fieldErrors: { email: "Email already registered" } },
      { status: 409 }
    );
  }
  // Guard the register-number side too: nobody may overwrite a record that
  // belongs to a different account.
  if (existing && session?.id !== existing.id && existingByEmail?.id !== existing.id) {
    return NextResponse.json(
      { error: "This register number was already submitted by another student", fieldErrors: { registerNumber: "Register number already exists" } },
      { status: 409 }
    );
  }

  // Locked identity: once a profile exists, its email and register number
  // are no longer editable from the form. Whatever the client sent, the
  // stored pair is written back — the record keeps the key it was created
  // with (the client also renders both fields read-only).
  //
  // A signed-in STUDENT can therefore only ever edit their own submission:
  // a changed identity can never spawn a second profile under their session.
  // Evaluators keep the original behaviour (their own profile only — the
  // guard above already rejects anyone else's register number).
  const ownRecord = session
    ? session.role === "STUDENT" && !session.canViewSubmissions
      ? await prisma.student.findUnique({
          where: { id: session.id },
          select: { id: true, email: true, registerNumber: true },
        })
      : existing && existing.id === session.id
        ? existing
        : existingByEmail && existingByEmail.id === session.id
          ? existingByEmail
          : null
    : null;
  if (ownRecord) {
    data.email = ownRecord.email;
    data.registerNumber = ownRecord.registerNumber;
    if (existing?.id !== ownRecord.id) {
      // The payload carried a different identity — still write to the
      // student's own record instead of creating a new one.
      existing = await prisma.student.findUnique({ where: { id: ownRecord.id } });
    }
  }

  // Default academic score from marks (coordinator-adjustable later).
  // Computed for EVERY submission path — including a signed-in coordinator
  // submitting their own placement profile under their account email.
  const academic = suggestAcademicScore(d.tenthPercent, d.twelfthPercent, cgpa);
  let academicScoreToSet = academic;

  if (existing) {
    const verifiedAcademicDocs = await prisma.document.count({
      where: {
        studentId: existing.id,
        category: {
          in: [
            "TENTH_MARKSHEET",
            "TWELFTH_MARKSHEET",
            "SEM1_MARKSHEET",
            "SEM2_MARKSHEET",
            "CGPA_MARKSHEET",
          ],
        },
        status: "VERIFIED",
      },
    });
    if (verifiedAcademicDocs > 0 && !isEvaluator) {
      // Academic records are verified by coordinator — retain stored verified marks
      data.tenthPercent = existing.tenthPercent;
      data.twelfthPercent = existing.twelfthPercent;
      data.sgpaSem1 = existing.sgpaSem1;
      data.sgpaSem2 = existing.sgpaSem2;
      data.cgpa = existing.cgpa > 0 ? existing.cgpa : cgpa;
      academicScoreToSet = existing.scoreAcademic > 0 ? existing.scoreAcademic : academic;
    }
  }

  let student;
  if (existing) {
    // Note: password is intentionally NOT accepted on resubmit — the submit
    // endpoint is public, so allowing it would let anyone take over an account.
    const newTotal = clampScores({
      academic: academicScoreToSet,
      github: existing.scoreGithub,
      coding: existing.scoreCoding,
      internship: existing.scoreInternship,
      certifications: existing.scoreCertifications,
      projects: existing.scoreProjects,
      fullstack: existing.scoreFullstack,
      hackathons: existing.scoreHackathons,
      inhouse: existing.scoreInhouse,
      membership: existing.scoreMembership,
      shl: existing.scoreShl,
    }).total;

    student = await prisma.student.update({
      where: { id: existing.id },
      data: {
        ...data,
        scoreAcademic: academicScoreToSet,
        totalScore: newTotal,
        // A resubmission invalidates the previous sign-off: the profile
        // goes back to pending AND the old verifier stamp is cleared (no
        // stale "verified by" attribution on an unverified record).
        status: "PENDING",
        verifiedById: null,
        verifiedByName: null,
        verifiedAt: null,
      },
      include: { scrapes: true },
    });
  } else if (isOwnEmail && existingByEmail) {
    // A signed-in user (e.g. a coordinator) submitting a placement profile
    // under their own account email: fill in the profile, keep the account
    // (role, evaluator assignment, password, and status stay intact).
    student = await prisma.student.update({
      where: { id: existingByEmail.id },
      data: { ...data, scoreAcademic: academic, totalScore: academic },
      include: { scrapes: true },
    });
  } else {
    student = await prisma.student.create({
      data: {
        ...data,
        scoreAcademic: academic,
        totalScore: academic,
        passwordHash: d.password ? hashPassword(d.password) : null,
      },
      include: { scrapes: true },
    });
  }

  // Safe bounded await (max 2.5s) so external scraper latency never hangs or crashes
  // concurrent student submissions on serverless. Scrapes write back to DB when settled.
  try {
    await Promise.race([
      enqueueScrapes(student.id, student.githubUrl, student.leetcodeUrl),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch (scrapeErr) {
    console.warn("Background scrape warning:", scrapeErr);
  }

  // Re-fetch so the response carries the freshly written scrape payloads.
  const fresh = await prisma.student.findUnique({
    where: { id: student.id },
    include: { scrapes: true, documents: true, projectLinks: true },
  });

    return NextResponse.json(
      { student: toDto(fresh ?? student), message: "Submission received — coding profiles scraped." },
      { status: existing ? 200 : 201 }
    );
  } catch (err) {
    console.error("POST /api/students error:", err);
    return NextResponse.json(
      { error: (err as Error)?.message || "Failed to submit profile. Please try again." },
      { status: 500 }
    );
  }
}
