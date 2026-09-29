"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type StudentBatch = {
  id: string;
  name: string;
};

type StudentSession = {
  id: string;
  batchId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  topic: string | null;
  location: string | null;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  attendanceRecord: {
    status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
    finalizedAt: string | null;
  } | null;
  batchName: string;
};

function formatSessionTime(date: string, startTime: string | null, endTime: string | null) {
  const timeFormat: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  const start = startTime ? new Date(startTime).toLocaleTimeString([], timeFormat) : null;
  const end = endTime ? new Date(endTime).toLocaleTimeString([], timeFormat) : null;

  return [new Date(date).toLocaleDateString(), start && end ? `${start} - ${end}` : start ?? end]
    .filter(Boolean)
    .join(" · ");
}

function SessionRow({ session, history = false }: { session: StudentSession; history?: boolean }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium text-slate-900">{session.topic || "Mentoring Session"}</h3>
          <span className={`rounded border px-2 py-0.5 text-xs font-medium ${
            session.status === "COMPLETED"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : session.status === "CANCELLED"
                ? "border-slate-200 bg-slate-100 text-slate-600"
                : "border-amber-200 bg-amber-50 text-amber-700"
          }`}>
            {session.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{session.batchName} · {formatSessionTime(session.date, session.startTime, session.endTime)}</p>
        {session.location && <p className="mt-1 text-sm text-muted-foreground">{session.location}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        {history && (
          <span className="text-sm text-slate-700">
            My attendance: <strong>{session.attendanceRecord?.status ?? "Not recorded"}</strong>
          </span>
        )}
        <Link
          href={`/student/sessions/${session.id}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          View details
        </Link>
      </div>
    </div>
  );
}

export function StudentSessionsOverview({ batches }: { batches: StudentBatch[] }) {
  const [sessions, setSessions] = useState<StudentSession[]>([]);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSessions() {
      setLoading(true);
      setError(null);

      try {
        const responses = await Promise.all(batches.map(async (batch) => {
          const response = await fetch(`/api/sessions?batchId=${encodeURIComponent(batch.id)}`, {
            signal: controller.signal,
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error ?? "Failed to load sessions.");
          return (payload.sessions as Omit<StudentSession, "batchName">[]).map((session) => ({
            ...session,
            batchName: batch.name,
          }));
        }));

        if (!controller.signal.aborted) {
          setSessions(responses.flat());
          setCurrentTime(Date.now());
        }
      } catch (cause: unknown) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Failed to load sessions.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadSessions();
    return () => controller.abort();
  }, [batches]);

  if (loading) {
    return <p className="py-6 text-sm text-muted-foreground" role="status">Loading your mentoring sessions...</p>;
  }

  if (error) {
    return <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</p>;
  }

  const now = currentTime ?? 0;
  const upcoming = sessions
    .filter((session) => session.status === "SCHEDULED" && new Date(session.date).getTime() >= now)
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
  const history = sessions
    .filter((session) => session.status !== "SCHEDULED" || new Date(session.date).getTime() < now)
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());

  return (
    <div className="space-y-4">
      {sessions.length === 0 && (
        <p className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-muted-foreground">
          No mentoring sessions are available for your current batches.
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-md shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Upcoming sessions</CardTitle>
            <CardDescription>{upcoming.length} scheduled</CardDescription>
          </CardHeader>
          <CardContent className="divide-y pt-0">
            {upcoming.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No upcoming sessions.</p>
            ) : upcoming.map((session) => <SessionRow key={session.id} session={session} />)}
          </CardContent>
        </Card>

        <Card className="rounded-md shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Session history</CardTitle>
            <CardDescription>Completed, cancelled, and past sessions</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[28rem] divide-y overflow-y-auto pt-0">
            {history.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No session history yet.</p>
            ) : history.map((session) => <SessionRow key={session.id} session={session} history />)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
