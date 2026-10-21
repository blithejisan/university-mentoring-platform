export function getSessionDisplayStatus(
  session: { status: string; date: string | Date; startTime?: string | Date | null },
  now = Date.now()
) {
  if (session.status !== "SCHEDULED") return session.status;

  const scheduledAt = new Date(session.startTime ?? session.date).getTime();
  return Number.isFinite(scheduledAt) && scheduledAt <= now ? "COMPLETED" : session.status;
}
