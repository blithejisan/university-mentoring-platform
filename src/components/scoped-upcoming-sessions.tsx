"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Role = "ADMIN" | "MODERATOR";
type Session = {
  id: string;
  batchId: string;
  date: string;
  startTime: string | null;
  topic: string | null;
  location: string | null;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  batchName: string;
};

export function ScopedUpcomingSessions({ role }: { role: Role }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const batchesResponse = await fetch("/api/batches", { signal: controller.signal });
        const batchesPayload = await batchesResponse.json();
        if (!batchesResponse.ok) throw new Error(batchesPayload.error ?? "Unable to load batches.");
        const batches = batchesPayload.batches as Array<{ id: string; name: string }>;
        const results = await Promise.all(batches.map(async (batch) => {
          const response = await fetch(`/api/sessions?batchId=${encodeURIComponent(batch.id)}`, { signal: controller.signal });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error ?? "Unable to load sessions.");
          return (payload.sessions as Omit<Session, "batchName">[]).map((session) => ({ ...session, batchName: batch.name }));
        }));
        if (!controller.signal.aborted) {
          setSessions(results.flat());
          setCurrentTime(Date.now());
        }
      } catch (cause: unknown) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load sessions.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const now = currentTime ?? 0;
  const upcoming = sessions
    .filter((session) => session.status === "SCHEDULED" && new Date(session.startTime ?? session.date).getTime() >= now)
    .sort((left, right) => new Date(left.startTime ?? left.date).getTime() - new Date(right.startTime ?? right.date).getTime())
    .slice(0, 8);

  return (
    <Card className="rounded-md shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><CalendarClock aria-hidden="true" className="size-4" />Upcoming mentoring sessions</CardTitle>
        <CardDescription>{role === "ADMIN" ? "Across your university" : "Across your department"}</CardDescription>
      </CardHeader>
      <CardContent className="divide-y pt-0">
        {loading ? <p className="py-4 text-sm text-muted-foreground" role="status">Loading upcoming sessions...</p>
          : error ? <p className="py-4 text-sm text-rose-700" role="alert">{error}</p>
            : upcoming.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No upcoming sessions.</p>
              : upcoming.map((session) => (
                <div key={session.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{session.topic || "Mentoring Session"}</p>
                    <p className="text-xs text-slate-600">{session.batchName} · {new Date(session.startTime ?? session.date).toLocaleString()}{session.location ? ` · ${session.location}` : ""}</p>
                  </div>
                  <Link className="shrink-0 text-sm font-medium text-primary hover:underline" href={`/${role.toLowerCase()}/sessions/${session.id}`}>Open session</Link>
                </div>
              ))}
      </CardContent>
    </Card>
  );
}
