import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enqueueScrapes } from "@/lib/pipeline";
import { clampScores, suggestAcademicScore } from "@/lib/score";
import { parseGithubLogin, parseLeetcodeUser } from "@/lib/utils";
import { toDto } from "@/lib/dto";
import { requireEvaluator, hashPassword, getSessionUser } from "@/lib/auth";
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
  cgpa: z.coerce.number().min(0, "Must be ≥ 0").max(10, "Must be ≤ 10"),
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

/** GET /api/students — evaluator-only leaderboard (ranked, all students) */
export async function GET() {
  const { error } = await requireEvaluator();
  if (error) return error;

  // Coordinators are hidden from the batch leaderboard EXCEPT when they have
  // submitted their own placement profile (real marks) — student-coordinators
  // then appear as candidates too. Pure faculty accounts (0 marks) stay hidden.
  const students = await prisma.student.findMany({
    where: {
      OR: [{ role: { not: "COORDINATOR" } }, { tenthPercent: { gt: 0 } }],
    },
    orderBy: [{ totalScore: "desc" }, { registerNumber: "asc" }],
    include: { scrapes: true, documents: true, projectLinks: true },
  });
  return NextResponse.json({ students: students.map((s) => toDto(s)) });
}

/** POST /api/students — student submission; creates or updates, then triggers scrapes */
export async function POST(req: Request) {
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

  const data = {
    registerNumber: d.registerNumber,
    fullName: d.fullName,
    email: d.email,
    facultyAdvisor: d.facultyAdvisor || null,
    tenthPercent: d.tenthPercent,
    twelfthPercent: d.twelfthPercent,
    cgpa: d.cgpa,
    githubUrl: d.githubUrl || null,
    leetcodeUrl: d.leetcodeUrl || null,
    proofUrls: JSON.stringify(proofUrls),
  };

  // Session awareness: a signed-in user submitting with their OWN email
  // updates their own record (coordinators can submit as students too);
  // anonymous submissions may never touch an existing account's email.
  const session = await getSessionUser();
  const existing = await prisma.student.findUnique({ where: { registerNumber: d.registerNumber } });
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

  // Default academic score from marks (coordinator-adjustable later).
  const academic = suggestAcademicScore(d.tenthPercent, d.twelfthPercent, d.cgpa);

  let student;
  if (existing) {
    // Note: password is intentionally NOT accepted on resubmit — the submit
    // endpoint is public, so allowing it would let anyone take over an account.
    student = await prisma.student.update({
      where: { id: existing.id },
      data: { ...data, scoreAcademic: academic, status: "PENDING" },
      include: { scrapes: true },
    });
  } else if (isOwnEmail && existingByEmail) {
    // A signed-in user (e.g. a coordinator) submitting a placement profile
    // under their own account email: fill in the profile, keep the account
    // (role, evaluator assignment, password, and status stay intact).
    student = await prisma.student.update({
      where: { id: existingByEmail.id },
      data,
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

  // Fire-and-forget background scrape jobs (student response returns now).
  enqueueScrapes(student.id, student.githubUrl, student.leetcodeUrl);

  return NextResponse.json(
    { student: toDto(student), message: "Submission received — profile scraping started." },
    { status: existing ? 200 : 201 }
  );
}
