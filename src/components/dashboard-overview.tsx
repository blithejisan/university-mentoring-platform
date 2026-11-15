import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { DashboardClock } from "@/components/dashboard-clock";

type DashboardMetric = {
  label: string;
  value: number;
  Icon: LucideIcon;
  tone: "cyan" | "violet" | "teal" | "amber";
  href?: string;
};

type DashboardOverviewProps = {
  role: string;
  name: string | null;
  universityName: string | null;
  departmentName: string | null;
  description: string;
  metrics: DashboardMetric[];
};

const metricTone: Record<DashboardMetric["tone"], string> = {
  cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200",
  violet: "border-violet-300/20 bg-violet-300/10 text-violet-200",
  teal: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
  amber: "border-amber-300/20 bg-amber-300/10 text-amber-200",
};

const metricSparkline: Record<DashboardMetric["tone"], string> = {
  cyan: "text-cyan-300/50",
  violet: "text-violet-300/50",
  teal: "text-emerald-300/50",
  amber: "text-amber-300/50",
};

function getInitials(name: string | null, role: string) {
  const words = name?.trim().split(/\s+/).filter(Boolean);
  if (!words?.length) return role.slice(0, 1);
  return words.length > 1
    ? `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
    : words[0].slice(0, 2).toUpperCase();
}

export function DashboardOverview({
  role,
  name,
  universityName,
  departmentName,
  description,
  metrics,
}: DashboardOverviewProps) {
  const roleLabel = role.toLowerCase();

  return (
    <section aria-label={`${roleLabel} dashboard overview`} className="space-y-4">
      <div className="dashboard-welcome relative isolate flex min-h-44 items-center overflow-hidden rounded-2xl border border-slate-600/50 px-5 py-6 shadow-[0_18px_48px_rgba(2,8,18,0.2)] sm:min-h-48 sm:px-8 sm:py-7">
        <Image
          src="/campus-banner.png"
          alt=""
          fill
          priority
          sizes="(max-width: 768px) 100vw, 1280px"
          className="absolute inset-0 -z-20 object-cover object-[center_58%]"
        />
        <div aria-hidden="true" className="dashboard-welcome-overlay absolute inset-0 -z-10" />
        <div className="flex w-full flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <div className="relative shrink-0">
              <div
                aria-hidden="true"
                className="flex size-14 items-center justify-center rounded-full border border-teal-200/30 bg-teal-500/15 text-lg font-semibold text-teal-300 shadow-[0_0_24px_rgba(20,184,166,0.18)] ring-4 ring-teal-500/20 backdrop-blur-md sm:size-[4.5rem] sm:text-xl"
              >
                {getInitials(name, role)}
              </div>
              <span aria-label="Online" className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-slate-900 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.75)]" />
            </div>
            <div className="min-w-0 max-w-3xl">
              <p className="text-sm font-medium text-cyan-100/90">Welcome back,</p>
              <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {name?.trim() || role} <span aria-hidden="true">👋</span>
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-100/90 sm:text-base">
                {description}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-100/90">
                {universityName && (
                  <span className="rounded-full border border-teal-200/25 bg-teal-950/35 px-3 py-1 text-teal-100 backdrop-blur">
                    {universityName}
                  </span>
                )}
                {departmentName && (
                  <span className="rounded-full border border-white/15 bg-slate-950/35 px-3 py-1 text-slate-100 backdrop-blur">
                    {departmentName}
                  </span>
                )}
                <span className="rounded-full border border-cyan-100/20 bg-cyan-300/10 px-3 py-1 capitalize text-cyan-50">
                  {roleLabel} workspace
                </span>
              </div>
            </div>
          </div>
          <DashboardClock initialTime={new Date().toISOString()} />
        </div>
      </div>

      <div
        className={`grid grid-cols-2 gap-3 ${
          metrics.length === 4
            ? "xl:grid-cols-4"
            : metrics.length === 3
              ? "xl:grid-cols-3"
              : ""
        }`}
      >
        {metrics.map(({ label, value, Icon, tone, href }) => (
          <div
            key={label}
            className="dashboard-metric relative flex min-w-0 flex-col items-start overflow-hidden rounded-xl border border-border/80 bg-card/85 p-3.5 shadow-sm backdrop-blur-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-teal-400/30 hover:shadow-[0_12px_30px_rgba(2,8,18,0.2)] sm:p-4"
          >
            <div className="relative z-10 flex min-w-0 items-center gap-3 sm:gap-4">
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-full border sm:size-12 ${metricTone[tone]}`}>
                <Icon aria-hidden="true" className="size-5 sm:size-6" />
              </span>
              <div className="min-w-0">
                <p className="text-xl font-semibold leading-none tracking-tight text-slate-50 sm:text-2xl">
                  {value.toLocaleString()}
                </p>
                <p className="mt-1.5 truncate text-xs font-medium text-slate-300 sm:text-sm">
                  {label}
                </p>
              </div>
            </div>
            {href && (
              <Link
                href={href}
                aria-label={`View ${label.toLowerCase()} details`}
                className="relative z-10 mt-3 inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs font-semibold text-teal-300 transition-colors hover:text-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/70"
              >
                View details <span aria-hidden="true">→</span>
              </Link>
            )}
            <svg aria-hidden="true" className={`pointer-events-none absolute -bottom-1 -right-1 h-12 w-24 ${metricSparkline[tone]}`} viewBox="0 0 96 48" fill="none">
              <path d="M1 39C12 39 13 27 23 30C32 33 33 19 43 23C53 27 57 33 66 21C75 9 78 14 84 19C89 23 92 11 96 8V48H1V39Z" fill="currentColor" fillOpacity=".08" />
              <path d="M1 39C12 39 13 27 23 30C32 33 33 19 43 23C53 27 57 33 66 21C75 9 78 14 84 19C89 23 92 11 96 8" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
        ))}
      </div>
    </section>
  );
}
