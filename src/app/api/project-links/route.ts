import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { isSubmissionsLocked } from "@/lib/settings";
import { linkToDto } from "@/lib/dto";
import { LINK_CATEGORY_KEYS } from "@/lib/categories";

export const dynamic = "force-dynamic";

const addSchema = z.object({
  category: z.string().refine((v) => LINK_CATEGORY_KEYS.includes(v), "Choose a valid link category"),
  label: z.string().trim().min(1, "Label is required").max(120),
  url: z.string().trim().url("Enter a valid URL").max(500),
});

/**
 * POST /api/project-links — add one project/portfolio link to the signed-in
 * user's own submission. Unlimited links.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to add links" }, { status: 401 });
  }

  // Submissions closed: students can no longer add links (evaluators bypass).
  const isEvaluatorUser = user.canViewSubmissions;
  if (!isEvaluatorUser && (await isSubmissionsLocked())) {
    return NextResponse.json(
      { error: "Submissions are closed by the coordinator. Please contact your coordinator." },
      { status: 423 }
    );
  }

  const student = await prisma.student.findUnique({ where: { id: user.id } });
  if (!student) {
    return NextResponse.json(
      { error: "Submit your placement profile first — links attach to your submission." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[i.path.join(".") || "form"] = i.message;
    return NextResponse.json({ error: "Validation failed", fieldErrors: fe }, { status: 422 });
  }

  const link = await prisma.projectLink.create({
    data: {
      studentId: student.id,
      category: parsed.data.category,
      label: parsed.data.label,
      url: parsed.data.url,
    },
  });
  return NextResponse.json({ link: linkToDto(link) }, { status: 201 });
}

/** DELETE /api/project-links?id=<linkId> — owner (or evaluator) removes a link. */
export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const link = await prisma.projectLink.findUnique({ where: { id } });
  if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  const isEvaluator = user.canViewSubmissions;
  if (link.studentId !== user.id && !isEvaluator) {
    return NextResponse.json({ error: "Not your link" }, { status: 403 });
  }
  if (link.status === "VERIFIED" && !isEvaluator) {
    return NextResponse.json(
      { error: "This link was already verified — ask a coordinator to remove it" },
      { status: 403 }
    );
  }

  await prisma.projectLink.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
