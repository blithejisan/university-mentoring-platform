"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  FileText,
  LayoutDashboard,
  Layers3,
  UserRound,
  UsersRound,
} from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

type SidebarItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
};

const roleItems: Record<string, SidebarItem[]> = {
  admin: [
    { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Batches", href: "/admin/batches", icon: Layers3 },
    { label: "Sessions", href: "/admin/dashboard#sessions", icon: CalendarDays },
    { label: "Mentors", href: "/admin/mentors", icon: UsersRound },
  ],
  moderator: [
    { label: "Dashboard", href: "/moderator/dashboard", icon: LayoutDashboard },
    { label: "Batches", href: "/moderator/batches", icon: Layers3 },
    { label: "Sessions", href: "/moderator/dashboard#sessions", icon: CalendarDays },
    { label: "Mentors", href: "/moderator/mentors", icon: UsersRound },
  ],
  mentor: [
    { label: "Dashboard", href: "/mentor/dashboard", icon: LayoutDashboard },
    { label: "Batches", href: "/mentor/batches", icon: Layers3 },
    { label: "Sessions", href: "/mentor/sessions", icon: CalendarDays },
    { label: "Mentors", href: "/mentor/mentors", icon: UsersRound },
  ],
  student: [
    { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
    { label: "Batches", href: "/student/batches", icon: Layers3 },
    { label: "Sessions", href: "/student/dashboard#sessions", icon: CalendarDays },
    { label: "Lab Report Generator", href: "/student/lab-report-generator", icon: FileText },
  ],
};

export function Sidebar() {
  const pathname = usePathname();
  const [hash, setHash] = useState("");
  const role = pathname.split("/")[1];
  const items = roleItems[role] ?? [];

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, [pathname]);

  if (!items.length && pathname !== "/profile") return null;

  const links = [...items, { label: "Profile & Security", href: "/profile", icon: UserRound }];

  return (
    <aside className="z-20 flex w-full shrink-0 flex-col border-b border-slate-700/70 bg-slate-900/75 backdrop-blur-md md:sticky md:top-0 md:h-full md:max-h-[calc(100dvh-4rem)] md:w-64 md:self-start md:overflow-y-auto md:border-b-0 md:border-r">
      <nav aria-label="Primary navigation" className="flex gap-1 overflow-x-auto p-3 md:min-h-0 md:flex-1 md:flex-col md:gap-1.5 md:overflow-y-auto md:p-4">
        {links.map(({ label, href, icon: Icon }) => {
          const hrefPath = href.split("#")[0];
          const isHashLink = href.includes("#");
          const active = isHashLink
            ? pathname === hrefPath && hash === `#${href.split("#")[1]}`
            : href === "/profile"
              ? pathname === href
              : href.endsWith("/dashboard")
                ? pathname === href && !hash
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`group flex min-h-11 shrink-0 items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 md:w-full ${
                active
                  ? "border-l-cyan-300 bg-cyan-400/10 text-cyan-100 shadow-[inset_0_0_18px_rgba(6,182,212,0.06),0_0_14px_rgba(6,182,212,0.08)]"
                  : "border-l-transparent text-slate-300 hover:border-l-cyan-500/50 hover:bg-slate-800/80 hover:text-slate-100"
              }`}
            >
              <Icon aria-hidden="true" className={`size-4 shrink-0 ${active ? "text-cyan-200" : "text-slate-400 group-hover:text-cyan-200"}`} />
              <span className="whitespace-nowrap">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex shrink-0 items-center justify-between gap-3 border-t border-slate-700/70 p-3 md:flex-col md:items-stretch md:p-4">
        <ThemeToggle />
        <p
          data-sidebar-brand
          className="hidden text-xs font-bold leading-relaxed text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)] md:block"
        >
          Green University of Bangladesh
        </p>
      </div>
    </aside>
  );
}
