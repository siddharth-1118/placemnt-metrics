import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDto } from "@/lib/dto";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/submission — the signed-in user's own submission with scrape
 * payloads and scores. Students can never see anyone else's data here.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const student = await prisma.student.findUnique({
    where: { id: user.id },
    include: { scrapes: true, documents: true, projectLinks: true },
  });
  if (!student) {
    return NextResponse.json({ error: "No submission found" }, { status: 404 });
  }
  return NextResponse.json({ student: toDto(student) });
}
