import { NextResponse } from "next/server";
import { z } from "zod";
import { requireScorer, getSessionUser } from "@/lib/auth";
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

/** POST /api/settings — super-admin-only portal toggle. */
export async function POST(req: Request) {
  const { user, error } = await requireScorer();
  if (error) return error;
  if (!user.isSuperAdmin) {
    return NextResponse.json(
      { error: "Only the super admin can open or close submissions" },
      { status: 403 }
    );
  }

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
