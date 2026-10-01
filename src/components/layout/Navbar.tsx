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
  const roleRoot = pathname.split("/")[1];
  const hasRolePath = /^\/(admin|moderator|mentor|student)(\/|$)/.test(pathname);
  const homeHref = isPendingApproval
    ? "/pending-approval"
    : hasRolePath
      ? `/${roleRoot}/dashboard`
      : "/";

  return (
    <header className="relative z-40 w-full shrink-0 border-b border-slate-700/70 bg-slate-900/90 px-4 py-2 shadow-sm shadow-slate-950/30 backdrop-blur-md sm:px-6">
      <div className="flex min-h-11 items-center justify-between gap-2 sm:gap-4">
        <Link
          href={homeHref}
          className="group flex min-w-0 items-center gap-2 sm:gap-3"
        >
          <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 p-1 shadow-sm transition-colors group-hover:border-cyan-500/50 sm:gap-2 sm:p-1.5">
            <div className="relative size-7 sm:size-9">
              <Image src="/gub-logo.png" alt="GUB logo" fill sizes="36px" className="object-contain" />
            </div>
            <div className="h-5 w-px bg-slate-600" />
            <div className="relative size-7 sm:size-9">
              <Image src="/ads-logo.png" alt="AI & Data Science logo" fill sizes="36px" className="object-contain" />
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-xs font-bold leading-tight text-slate-50 transition-colors group-hover:text-cyan-100 sm:text-base">
              Mentor &amp; Student Management Platform
            </span>
            <span className="truncate text-[10px] font-medium leading-snug text-slate-300 sm:text-xs">
              Department of AI &amp; Data Science
            </span>
          </div>
        </Link>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {hasRolePath && !isPendingApproval && <NotificationCenter />}
          {(hasRolePath || pathname === "/profile") && (
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