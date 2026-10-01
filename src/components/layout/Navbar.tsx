"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { NotificationCenter } from "@/components/notification-center";
import { UserRound } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const isPendingApproval = pathname.startsWith("/pending-approval");
  const roleRoot = pathname.split("/")[1];
  const hasRolePath = /^\/(admin|moderator|mentor|student)(\/|$)/.test(pathname);
  const pageName = pathname.split("/").filter(Boolean).pop()?.split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") ?? "Dashboard";
  const pageTitle = pathname.endsWith("/dashboard")
    ? `${roleRoot.charAt(0).toUpperCase()}${roleRoot.slice(1)} Dashboard`
    : pathname === "/"
      ? "Dashboard"
      : pathname === "/profile"
        ? "Profile & Security"
        : pageName;

  return (
    <header className="relative z-40 w-full shrink-0 border-b border-slate-700/70 bg-slate-900/90 px-4 py-2 shadow-sm shadow-slate-950/30 backdrop-blur-md sm:px-6">
      <div className="flex h-10 items-center justify-between gap-4">
        <h1 className="min-w-0 truncate text-base font-semibold text-slate-100 sm:text-lg">
          {isPendingApproval ? "Pending Approval" : pageTitle}
        </h1>

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