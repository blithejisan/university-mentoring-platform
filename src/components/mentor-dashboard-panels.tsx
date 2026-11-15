import Link from "next/link";
import {
  Activity,
  CalendarDays,
  CalendarPlus,
  Clock3,
  Trophy,
  UsersRound,
} from "lucide-react";

type MentorBatchSummary = {
  id: string;
  name: string;
  status: string;
  completedSessions: number;
  scheduledSessions: number;
  nextSession: {
    date: Date;
    startTime: Date | null;
    topic: string | null;
  } | null;
};

type DashboardActivity = {
  id: string;
  title: string;
  subtitle: string;
  occurredAt: Date;
  tone: "teal" | "blue" | "violet";
};

function formatRelativeTime(date: Date, now: number) {
  const elapsedSeconds = Math.round((date.getTime() - now) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(elapsedSeconds) < 60) return "just now";
  for (const [unit, secondsPerUnit] of units) {
    if (Math.abs(elapsedSeconds) >= secondsPerUnit) {
      return formatter.format(Math.round(elapsedSeconds / secondsPerUnit), unit);
    }
  }
  return "just now";
}

const activityTone: Record<DashboardActivity["tone"], string> = {
  teal: "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]",
  blue: "bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.6)]",
  violet: "bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.6)]",
};

const batchThemes = [
  {
    card: "border-[#1499A8]/30 border-l-[#1499A8] hover:border-[#1499A8]/60",
    badge: "border-[#1499A8]/40 bg-[#1499A8]/15 text-[#55c7d2] ring-[#1499A8]/15",
    progress: "from-[#1499A8] to-[#55c7d2]",
  },
  {
    card: "border-[#8B9FE8]/30 border-l-[#8B9FE8] hover:border-[#8B9FE8]/60",
    badge: "border-[#8B9FE8]/40 bg-[#8B9FE8]/15 text-[#b3c0ff] ring-[#8B9FE8]/15",
    progress: "from-[#8B9FE8] to-[#b3c0ff]",
  },
] as const;

export function MentorDashboardPanels({
  batches,
  activities,
  currentTime,
}: {
  batches: MentorBatchSummary[];
  activities: DashboardActivity[];
  currentTime: Date;
}) {
  const now = currentTime.getTime();

  return (
    <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(18rem,1fr)]" aria-label="Mentor workspace">
      <div className="rounded-2xl border border-slate-500/20 bg-card/85 p-4 shadow-sm backdrop-blur-md transition-all duration-200 ease-out hover:border-teal-400/25 hover:shadow-[0_12px_30px_rgba(2,8,18,0.2)] sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border border-teal-400/20 bg-teal-400/10 text-teal-300">
              <CalendarDays aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-foreground sm:text-lg">Mentoring Sessions</h2>
              <p className="text-xs text-muted-foreground sm:text-sm">Schedule and manage sessions for your assigned batches.</p>
            </div>
          </div>
          <Link
            href="/mentor/sessions"
            className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-teal-300 transition-all duration-200 ease-out hover:bg-teal-400/10 hover:text-teal-200 active:scale-[0.98] sm:text-sm"
          >
            View all <span aria-hidden="true">→</span>
          </Link>
        </div>

        {batches.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-500/30 px-4 py-8 text-center text-sm text-muted-foreground">
            No batches are currently assigned to you.
          </p>
        ) : (
          <div className="space-y-3">
            {batches.map((batch, index) => {
              const theme = batchThemes[index % batchThemes.length];
              const totalTrackedSessions = batch.completedSessions + batch.scheduledSessions;
              const progress = totalTrackedSessions
                ? Math.min(100, Math.round((batch.completedSessions / totalTrackedSessions) * 100))
                : 0;
              const status = batch.nextSession
                ? "Upcoming"
                : batch.status === "ACTIVE"
                  ? "Active"
                  : batch.status.charAt(0) + batch.status.slice(1).toLowerCase();

              return (
                <article
                  key={batch.id}
                  className={`rounded-xl border border-l-2 bg-[#15273a]/80 p-4 transition-colors duration-200 hover:bg-[#192f45] ${theme.card}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <Link
                        href={`/mentor/batches/${batch.id}`}
                        aria-label={`View ${batch.name} batch details`}
                        className={`flex size-11 shrink-0 items-center justify-center rounded-full border ring-4 transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#15273a] active:scale-[0.98] ${theme.badge}`}
                      >
                        <UsersRound aria-hidden="true" className="size-5" />
                      </Link>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold sm:text-base">
                            <Link
                              href={`/mentor/batches/${batch.id}`}
                              className="rounded-sm text-foreground transition-colors hover:text-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/70"
                            >
                              {batch.name}
                            </Link>
                          </h3>
                          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                            status === "Upcoming"
                              ? "border-sky-400/25 bg-sky-400/10 text-sky-300"
                              : status === "Active"
                                ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                                : "border-slate-400/20 bg-slate-400/10 text-slate-300"
                          }`}>
                            {status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">Mentoring sessions</p>
                      </div>
                    </div>
                    <Link
                      href="/mentor/sessions"
                      className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-teal-300/25 bg-teal-500/15 px-3 text-xs font-semibold text-teal-200 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-teal-500/25 hover:shadow-[0_0_18px_rgba(20,184,166,0.12)] active:scale-[0.98]"
                    >
                      <CalendarPlus aria-hidden="true" className="size-3.5" />
                      + Schedule New Session
                    </Link>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock3 aria-hidden="true" className="size-4 text-sky-300" />
                      <span>
                        Next session:{" "}
                        <span className="font-medium text-foreground">
                          {batch.nextSession
                            ? `${new Intl.DateTimeFormat("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              }).format(batch.nextSession.date)}${batch.nextSession.startTime
                                ? `, ${new Intl.DateTimeFormat("en-US", {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  }).format(batch.nextSession.startTime)}`
                                : ""}`
                            : "Not scheduled"}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Completed / total</span>
                      <span className="font-medium text-foreground">
                        {batch.completedSessions} / {totalTrackedSessions}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {batch.completedSessions} completed · {batch.scheduledSessions} scheduled
                  </p>
                  <div
                    className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-600/40"
                    role="progressbar"
                    aria-label={`${batch.name} completed sessions`}
                    aria-valuemin={0}
                    aria-valuemax={Math.max(totalTrackedSessions, 1)}
                    aria-valuenow={batch.completedSessions}
                  >
                    <div
                      className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-500 ${theme.progress}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-slate-500/20 bg-card/85 p-4 shadow-sm backdrop-blur-md transition-all duration-200 ease-out hover:border-teal-400/25 hover:shadow-[0_12px_30px_rgba(2,8,18,0.2)] sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Activity aria-hidden="true" className="size-5 text-teal-300" />
              <h2 className="text-base font-semibold text-foreground">Recent Activity</h2>
            </div>
            <Link
              href="/mentor/dashboard#notices"
              className="rounded-md px-2 py-1 text-xs font-semibold text-teal-300 transition-all duration-200 ease-out hover:bg-teal-400/10 hover:text-teal-200 active:scale-[0.98]"
            >
              View all <span aria-hidden="true">→</span>
            </Link>
          </div>
          {activities.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No recent notices or session updates.</p>
          ) : (
            <ol className="space-y-4">
              {activities.map((activity, index) => (
                <li key={activity.id} className="relative flex gap-3">
                  {index < activities.length - 1 && (
                    <span aria-hidden="true" className="absolute left-[5px] top-3 h-[calc(100%+0.5rem)] w-px bg-slate-500/30" />
                  )}
                  <span aria-hidden="true" className={`relative mt-1.5 size-2.5 shrink-0 rounded-full ${activityTone[activity.tone]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">{activity.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{activity.subtitle}</p>
                  </div>
                  <time className="shrink-0 pt-0.5 text-[10px] text-muted-foreground sm:text-xs" dateTime={activity.occurredAt.toISOString()}>
                    {formatRelativeTime(activity.occurredAt, now)}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="relative isolate overflow-hidden rounded-2xl border border-slate-500/20 bg-card/85 p-4 shadow-sm transition-all duration-200 ease-out hover:border-teal-400/25 hover:shadow-[0_12px_30px_rgba(2,8,18,0.2)] sm:p-5">
          <svg aria-hidden="true" className="pointer-events-none absolute -bottom-8 -right-4 -z-10 h-32 w-48 text-teal-400/25" viewBox="0 0 192 128" fill="none">
            <path d="M192 0C148 20 154 73 97 91C56 104 33 102 0 128H192V0Z" fill="currentColor" />
            <path d="M192 25C160 49 164 83 126 102C104 113 86 119 66 128H192V25Z" fill="currentColor" fillOpacity=".7" />
          </svg>
          <div className="relative flex items-center gap-3">
            <Trophy aria-hidden="true" className="size-9 shrink-0 text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.2)]" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Keep up the great work!</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Your mentorship makes a difference.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
