import Image from "next/image";
import type { LucideIcon } from "lucide-react";

type DashboardMetric = {
  label: string;
  value: number;
  Icon: LucideIcon;
  tone: "cyan" | "violet" | "teal" | "amber";
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
        <div className="flex w-full items-center gap-4 sm:gap-6">
          <div
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full border border-cyan-100/35 bg-slate-950/50 text-lg font-semibold text-cyan-50 shadow-lg shadow-slate-950/30 ring-4 ring-cyan-100/10 backdrop-blur-md sm:size-[4.5rem] sm:text-xl"
          >
            {getInitials(name, role)}
          </div>
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-cyan-100/90">Welcome back,</p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {name?.trim() || role}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-100/90 sm:text-base">
              {description}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-100/90">
              {universityName && (
                <span className="rounded-full border border-white/15 bg-slate-950/35 px-3 py-1 backdrop-blur">
                  {universityName}
                </span>
              )}
              {departmentName && (
                <span className="rounded-full border border-white/15 bg-slate-950/35 px-3 py-1 backdrop-blur">
                  {departmentName}
                </span>
              )}
              <span className="rounded-full border border-cyan-100/20 bg-cyan-300/10 px-3 py-1 capitalize text-cyan-50">
                {roleLabel} workspace
              </span>
            </div>
          </div>
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
        {metrics.map(({ label, value, Icon, tone }) => (
          <div
            key={label}
            className="dashboard-metric flex min-w-0 items-center gap-3 rounded-xl border border-slate-700/70 bg-slate-900/70 p-3.5 shadow-sm backdrop-blur-md transition-colors sm:gap-4 sm:p-4"
          >
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
        ))}
      </div>
    </section>
  );
}
