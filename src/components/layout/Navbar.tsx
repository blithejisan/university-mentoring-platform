"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { NotificationCenter } from "@/components/notification-center";
import { UserRound } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const isPendingApproval = pathname.startsWith("/pending-approval");
  const roleRoot = isPendingApproval ? "mentor" : pathname.split("/")[1];
  const roleRoutes: Record<string, { dashboard: string; batches: string; sessions: string; mentors?: string }> = {
    admin: {
      dashboard: "/admin/dashboard",
      batches: "/admin/batches",
      sessions: "/admin/dashboard#sessions",
      mentors: "/admin/mentors",
    },
    moderator: {
      dashboard: "/moderator/dashboard",
      batches: "/moderator/batches",
      sessions: "/moderator/dashboard#sessions",
      mentors: "/moderator/mentors",
    },
    mentor: {
      dashboard: "/mentor/dashboard",
      batches: "/mentor/batches",
      sessions: "/mentor/sessions",
      mentors: "/mentor/mentors",
    },
    student: {
      dashboard: "/student/dashboard",
      batches: "/student/batches",
      sessions: "/student/dashboard#sessions",
    },
  };
  const routes = roleRoutes[roleRoot];
  return (
    <header className="relative z-40 w-full shrink-0 border-b border-slate-700/70 bg-slate-900/90 px-4 py-3 shadow-sm shadow-slate-950/30 backdrop-blur-md sm:px-6">
      <div className="flex min-h-11 items-center justify-between gap-4">
        
        {/* Left Side: Brand Logo & Updated Title */}
        <Link href={isPendingApproval ? "/pending-approval" : routes?.dashboard ?? "/"} className="group flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 p-1.5 shadow-sm transition-colors group-hover:border-cyan-500/50 sm:gap-2.5 sm:p-2">
            <div className="relative size-8 sm:size-9">
              <Image
                src="/gub-logo.png"
                alt="GUB Logo"
                fill
                className="object-contain"
              />
            </div>
            <div className="h-5 w-[1px] bg-slate-600" />
            <div className="relative size-8 sm:size-9">
              <Image
                src="/ads-logo.png"
                alt="ADS Logo"
                fill
                className="object-contain"
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-semibold leading-tight text-slate-100 transition-colors group-hover:text-cyan-200 sm:text-base">
              Mentor & Student Management Platform
            </span>
            <span className="truncate text-[11px] font-medium leading-snug text-slate-300 sm:text-xs">
              Department of AI & Data Science
            </span>
          </div>
        </Link>

        {/* Header actions */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {routes && !isPendingApproval && <NotificationCenter />}
          {(routes || pathname === "/profile") && (
            <>
              <Link
                href="/profile"
                aria-label="Profile and security"
                title="Profile and security"
                className={`inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-md border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 sm:px-3 sm:text-sm ${
                  pathname === "/profile"
                    ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
                    : "border-slate-700 bg-slate-800 text-slate-200 hover:border-cyan-500/50 hover:bg-slate-700 hover:text-cyan-100"
                }`}
              >
                <UserRound aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">Profile</span>
              </Link>
              <LogoutButton
                showIcon
                className="h-9 rounded-md border-slate-700 bg-slate-800 px-2.5 text-xs font-semibold text-slate-200 shadow-none transition-colors hover:border-cyan-500/50 hover:bg-slate-700 hover:text-cyan-100 sm:px-3 sm:text-sm"
              />
            </>
          )}
        </div>
      </div>
    </header>
  );
}