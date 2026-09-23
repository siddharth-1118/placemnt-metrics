import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/notifications — the signed-in user's notifications + unread count. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const notifications = await prisma.notification.findMany({
    where: { studentId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      kind: n.kind,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
    unread: notifications.filter((n) => !n.readAt).length,
  });
}

/** POST /api/notifications — mark all (or one, via {id}) as read. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let body: { id?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* body optional */
  }

  await prisma.notification.updateMany({
    where: { studentId: user.id, ...(body.id ? { id: body.id } : {}), readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
