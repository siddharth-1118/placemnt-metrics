import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueueScrapes, runSingleScrape } from "@/lib/pipeline";
import { parseGithubLogin, parseLeetcodeUser } from "@/lib/utils";
import { getSessionUser } from "@/lib/auth"; // user.canViewSubmissions replaces the old role check

export const dynamic = "force-dynamic";

/**
 * POST /api/students/:id/rescrape — re-run the scrape jobs for one student.
 * Body: { platform?: "GITHUB" | "LEETCODE" } (omit to re-scrape both).
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  // Assigned evaluators may re-scrape anyone; a student may re-scrape only
  // their own profiles.
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const isEvaluator = user.canViewSubmissions;
  if (!isEvaluator && user.id !== params.id) {
    return NextResponse.json({ error: "You can only re-scrape your own profiles" }, { status: 403 });
  }

  const student = await prisma.student.findUnique({ where: { id: params.id } });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  let platform: string | undefined;
  try {
    const body = (await req.json()) as { platform?: string };
    platform = body?.platform?.toUpperCase();
  } catch {
    // no body → re-scrape everything
  }

  if (platform === "GITHUB" || platform === "LEETCODE") {
    const url = platform === "GITHUB" ? student.githubUrl : student.leetcodeUrl;
    const handle =
      platform === "GITHUB" ? parseGithubLogin(url ?? "") : parseLeetcodeUser(url ?? "");
    if (!handle) {
      return NextResponse.json(
        { error: `Student has no valid ${platform.toLowerCase()} profile URL` },
        { status: 400 }
      );
    }
    await runSingleScrape(student.id, platform, handle);
  } else {
    await enqueueScrapes(student.id, student.githubUrl, student.leetcodeUrl);
  }

  return NextResponse.json({ ok: true, message: "Re-scrape finished" });
}
