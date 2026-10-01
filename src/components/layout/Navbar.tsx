"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { NotificationCenter } from "@/components/notification-center";
import { FlaskConical } from "lucide-react";

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
  const navItems = routes && !isPendingApproval
    ? [
        { name: "Dashboard", href: routes.dashboard },
        { name: "Batches", href: routes.batches },
        { name: "Sessions", href: routes.sessions },
        ...(roleRoot === "student" ? [{ name: "Lab Report Generator", href: "/student/lab-report-generator" }] : []),
        ...(routes.mentors ? [{ name: "Mentors", href: routes.mentors }] : []),
      ]
    : [];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/70 bg-white/90 px-4 py-3 shadow-sm shadow-slate-900/[0.03] backdrop-blur-md sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-3">
        
        {/* Left Side: Brand Logo & Updated Title */}
        <Link href={isPendingApproval ? "/pending-approval" : routes?.dashboard ?? "/"} className="group flex min-w-0 basis-full items-center gap-2.5 sm:gap-3 lg:basis-auto lg:flex-1">
          <div className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm transition-colors group-hover:border-slate-400 sm:gap-2.5 sm:p-2">
            <div className="relative size-8 sm:size-9">
              <Image
                src="/gub-logo.png"
                alt="GUB Logo"
                fill
                className="object-contain"
              />
            </div>
            <div className="h-5 w-[1px] bg-slate-200" />
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
            <span className="truncate text-sm font-semibold leading-tight text-[#21382d] transition-colors group-hover:text-[#236543] sm:text-base lg:text-lg">
              Mentor & Student Management Platform
            </span>
            <span className="truncate text-[11px] font-medium leading-snug text-[#5c6c62] sm:text-xs">
              Department of AI & Data Science
            </span>
          </div>
        </Link>

        {/* Center Navigation Links */}
        <nav className="order-3 flex w-full shrink-0 flex-wrap items-center gap-2 lg:order-none lg:w-auto lg:flex-none lg:flex-nowrap">
          {navItems.map((item) => {
            const isFeatured = item.href === "/student/lab-report-generator";
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`inline-flex h-9 items-center whitespace-nowrap rounded-md border px-2.5 text-xs font-semibold transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 sm:px-3 sm:text-sm ${
                  isFeatured
                    ? "lab-generator-link gap-1.5"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`)
                    ? "border-[#cfe1d2] bg-[#eaf3e9] text-[#205b3d] shadow-[0_0_12px_rgba(33,97,63,0.08)]"
                    : "border-transparent text-slate-600 hover:-translate-y-0.5 hover:border-[#dce5dc] hover:bg-[#f5f8f3] hover:text-[#21382d]"
                }`}
              >
                {isFeatured && <FlaskConical aria-hidden="true" className="size-3.5" />}
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Right Side: Functional Student Portal Link Only */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <a
            href="https://studentportal.green.edu.bd"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 rounded-md border border-[#cbd8ce] px-2.5 py-2 text-xs font-semibold text-[#33483c] transition-colors hover:border-[#8eaa96] hover:bg-[#f5f8f3] hover:text-[#205b3d] sm:inline-flex sm:px-3 sm:text-sm"
          >
            <span>Student Portal</span>
            <span className="text-xs font-semibold">↗</span>
          </a>
          {routes && !isPendingApproval && <NotificationCenter />}
          {routes && (
            <LogoutButton
              showIcon
              className="h-9 rounded-md border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-none transition-colors hover:border-[#9fbaa7] hover:bg-[#edf5ee] hover:text-[#205b3d] sm:px-3 sm:text-sm"
            />
          )}
        </div>

      </div>
    </header>
  );
}