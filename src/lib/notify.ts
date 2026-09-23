import { prisma } from "@/lib/prisma";

/**
 * Create an in-app notification for a student. Never throws — notifications
 * are a side effect and must not break the main API call.
 */
export async function notify(input: {
  studentId: string;
  title: string;
  body: string;
  kind?: "INFO" | "WARNING";
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        studentId: input.studentId,
        title: input.title,
        body: input.body,
        kind: input.kind ?? "INFO",
      },
    });
  } catch (err) {
    console.warn("[notify] failed:", (err as Error).message);
  }
}
