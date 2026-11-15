"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock3 } from "lucide-react";

export function DashboardClock({ initialTime }: { initialTime: string }) {
  const [currentTime, setCurrentTime] = useState(() => new Date(initialTime));

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="flex shrink-0 items-center gap-5 border-t border-white/10 pt-4 text-slate-100 sm:min-h-20 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
      <div className="flex items-center gap-3">
        <CalendarDays aria-hidden="true" className="size-5 shrink-0 text-slate-300" />
        <span suppressHydrationWarning className="text-sm font-medium tabular-nums">
          {new Intl.DateTimeFormat("en-GB", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric",
          }).format(currentTime)}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Clock3 aria-hidden="true" className="size-5 shrink-0 text-slate-300" />
        <span suppressHydrationWarning className="text-sm font-medium tabular-nums">
          {new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }).format(currentTime)}
        </span>
      </div>
    </div>
  );
}
