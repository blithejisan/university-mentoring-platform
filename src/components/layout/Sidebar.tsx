"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  BarChart3,
  Award,
  BellRing,
  ExternalLink,
  FileText,
  LayoutDashboard,
  Layers3,
  MessageSquareText,
  Megaphone,
  MessageSquare,
  Star,
  UserCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

type SidebarItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  external?: boolean;
  group: string;
};

const studentPortalItem: SidebarItem = {
  label: "Student Portal",
  href: "https://studentportal.green.edu.bd",
  icon: ExternalLink,
  external: true,
  group: "Resources",
};

const roleItems: Record<string, SidebarItem[]> = {
  admin: [
    { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard, group: "Overview" },
    { label: "Batches", href: "/admin/batches", icon: Layers3, group: "Management" },
    { label: "Sessions", href: "/admin/dashboard#sessions", icon: CalendarDays, group: "Management" },
    { label: "Mentors", href: "/admin/mentors", icon: UsersRound, group: "Management" },
    { label: "CR Management", href: "/admin/cr-management", icon: UserCheck, group: "Management" },
    { label: "My Batch", href: "/admin/my-batch", icon: Megaphone, group: "Management" },
    { label: "Mentor Applications", href: "/admin/mentors/pending", icon: UserCheck, group: "Quick access" },
    { label: "Batch Performance", href: "/admin/dashboard#batch-performance", icon: BarChart3, group: "Quick access" },
    { label: "Notice Management", href: "/admin/dashboard#notices", icon: BellRing, group: "Quick access" },
  ],
  moderator: [
    { label: "Dashboard", href: "/moderator/dashboard", icon: LayoutDashboard, group: "Overview" },
    { label: "Batches", href: "/moderator/batches", icon: Layers3, group: "Management" },
    { label: "Sessions", href: "/moderator/dashboard#sessions", icon: CalendarDays, group: "Management" },
    { label: "Mentors", href: "/moderator/mentors", icon: UsersRound, group: "Management" },
    { label: "CR Management", href: "/moderator/cr-management", icon: UserCheck, group: "Management" },
    { label: "Mentor Applications", href: "/moderator/mentors/pending", icon: UserCheck, group: "Quick access" },
    { label: "Coordination Hub", href: "/moderator/coordination", icon: MessageSquare, group: "Quick access" },
    { label: "Batch Performance", href: "/moderator/dashboard#batch-performance", icon: BarChart3, group: "Quick access" },
    { label: "Notice Management", href: "/moderator/dashboard#notices", icon: BellRing, group: "Quick access" },
  ],
  mentor: [
    { label: "Dashboard", href: "/mentor/dashboard", icon: LayoutDashboard, group: "Overview" },
    { label: "Batches", href: "/mentor/batches", icon: Layers3, group: "Workspace" },
    { label: "Sessions", href: "/mentor/sessions", icon: CalendarDays, group: "Workspace" },
    { label: "Mentors", href: "/mentor/mentors", icon: UsersRound, group: "Workspace" },
    { label: "Session Notices", href: "/mentor/dashboard#notices", icon: BellRing, group: "Quick access" },
    { label: "Coordination Hub", href: "/mentor/coordination", icon: MessageSquare, group: "Quick access" },
    { label: "My Batch", href: "/student/my-batch", icon: Megaphone, group: "Student workspace" },
    { label: "Lab Report Generator", href: "/student/lab-report-generator", icon: FileText, group: "Student workspace" },
    { label: "Session Remarks", href: "/mentor/dashboard#remarks", icon: MessageSquareText, group: "Quick access" },
    { label: "My Evaluation", href: "/mentor/dashboard#my-evaluation", icon: Award, group: "Quick access" },
    studentPortalItem,
  ],
  student: [
    { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard, group: "Overview" },
    { label: "Batches", href: "/student/batches", icon: Layers3, group: "Workspace" },
    { label: "Sessions", href: "/student/dashboard#sessions", icon: CalendarDays, group: "Workspace" },
    { label: "Lab Report Generator", href: "/student/lab-report-generator", icon: FileText, group: "Workspace" },
    { label: "Mentor Evaluation", href: "/student/evaluations", icon: Star, group: "Workspace" },
    { label: "My Batch", href: "/student/my-batch", icon: Megaphone, group: "Workspace" },
    { label: "Session Notices", href: "/student/dashboard#notices", icon: BellRing, group: "Quick access" },
    { label: "Session Remarks", href: "/student/dashboard#remarks", icon: MessageSquareText, group: "Quick access" },
    studentPortalItem,
  ],
};

export function Sidebar() {
  const pathname = usePathname();
  const [hash, setHash] = useState("");
  const [accountRole, setAccountRole] = useState<string | null>(null);
  const routeRole = pathname.split("/")[1];
  const role = routeRole === "student" && accountRole === "MENTOR" ? "mentor" : routeRole;
  const items = roleItems[role] ?? [];

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.user?.role) setAccountRole(data.user.role);
      })
      .catch((error) => console.error("Could not load navigation role.", error));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!items.length && pathname !== "/profile") return null;

  const links = [
    ...items,
    { label: "Profile & Security", href: "/profile", icon: UserRound, group: "Account" },
  ];
  return (
    <aside className="z-20 flex w-full shrink-0 flex-col border-b border-slate-700/70 bg-slate-900/75 backdrop-blur-md md:sticky md:top-16 md:h-[calc(100vh-4rem)] md:w-64 md:self-start md:overflow-y-auto md:border-b-0 md:border-r">
      <nav aria-label="Primary navigation" className="flex gap-1 overflow-x-auto p-3 md:flex-1 md:flex-col md:gap-1.5 md:p-4">
        {links.map(({ label, href, icon: Icon, external, group }, index) => {
          const showGroup = index === 0 || links[index - 1].group !== group;
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
            <div key={href} className="flex shrink-0 flex-col gap-1 md:w-full">
              {showGroup && (
                <p className="hidden px-3 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 md:block">
                  {group}
                </p>
              )}
              <Link
                href={href}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
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
            </div>
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
