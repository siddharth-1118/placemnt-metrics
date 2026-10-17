import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { getArchiveContent } from "@/lib/auto-archive";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/archives/:filename — Download a specific historical snapshot JSON.
 * Super Admin only.
 */
export async function GET(
  _req: Request,
  { params }: { params: { filename: string } }
) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const content = await getArchiveContent(params.filename);

  if (!content) {
    return NextResponse.json({ error: "Archive snapshot not found" }, { status: 404 });
  }

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${params.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
