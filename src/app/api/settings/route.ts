import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEvaluator, getSessionUser } from "@/lib/auth";
import { isSubmissionsLocked, setSubmissionsLocked } from "@/lib/settings";

export const dynamic = "force-dynamic";

const schema = z.object({ locked: z.boolean() });

/**
 * GET /api/settings — current portal settings. Any signed-in user may read
 * the lock flag (students need it to show the closed banner); anonymous
 * requests get the default too so the public form can render its state.
 */
export async function GET() {
  const locked = await isSubmissionsLocked();
  return NextResponse.json({ submissionsLocked: locked });
}

/** POST /api/settings — evaluator-only toggle. */
export async function POST(req: Request) {
  const { error } = await requireEvaluator();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Expected { locked: boolean }" }, { status: 422 });
  }

  await setSubmissionsLocked(parsed.data.locked);
  return NextResponse.json({ ok: true, submissionsLocked: parsed.data.locked });
}
