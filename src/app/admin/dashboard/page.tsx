import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { AdminNoticesManagement } from "@/components/admin-notices-management";
import { DepartmentRemarksOversight } from "@/components/department-remarks-oversight";
import { DepartmentAttendanceOverviewCard } from "@/components/department-attendance-overview";
import { SessionMonitoringDashboard } from "@/components/session-monitoring-dashboard";
import { BatchPerformanceReport } from "@/components/batch-performance-report";
import { ScopedUpcomingSessions } from "@/components/scoped-upcoming-sessions";
import { EmailTemplateSettings } from "@/components/email-template-settings";

export default async function AdminDashboardPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  const admin = await prisma.user.findUnique({ where: { id: session.sub }, select: { universityId: true } });
  const departments = admin
    ? await prisma.department.findMany({
        where: { universityId: admin.universityId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="space-y-7 animate-fade-in">
      
      {/* Top Header & Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#102944] to-[#193b5d] p-6 text-white shadow-lg shadow-slate-900/10 border border-[#244969] sm:p-8">
        
        <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100">
              <span className="size-2 rounded-full bg-emerald-400" />
              <span>ADS Department Active Portal</span>
            </div>
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
              Admin Portal Dashboard
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-200">
              Manage batches, approve mentor credentials, monitor student attendance thresholds, and broadcast university-wide notices.
            </p>
          </div>

        </div>
      </div>

      <section id="sessions" className="scroll-mt-4 space-y-7">
        <SessionMonitoringDashboard role="ADMIN" />
        <ScopedUpcomingSessions role="ADMIN" />
      </section>
      <DepartmentAttendanceOverviewCard departments={departments} />
      <BatchPerformanceReport role="ADMIN" />

      {/* Quick Action Navigation Cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        
        {/* Card 1: Mentor Applications */}
        <div className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700">
                Action Required
              </span>
              <span className="text-xs font-medium text-slate-500">Mentor Oversight</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              Mentor Applications
            </h3>
            <p className="text-sm leading-relaxed text-slate-600">
              Review mentor applications awaiting approval across all university departments.
            </p>
          </div>
          <div className="pt-6">
            <Link href="/admin/mentors/pending">
              <Button variant="default" className="w-full sm:w-auto">
                View Pending Mentors →
              </Button>
            </Link>
          </div>
        </div>

        {/* Card 2: Batches & Assignments */}
        <div className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800">
                Batch Structure
              </span>
              <span className="text-xs font-medium text-slate-500">Batch Management</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              Batches & Assignments
            </h3>
            <p className="text-sm leading-relaxed text-slate-600">
              Create batches, assign mentors, and assign students to batches across departments.
            </p>
          </div>
          <div className="pt-6">
            <Link href="/admin/batches">
              <Button variant="secondary" className="w-full sm:w-auto">
                Manage Batches & Assignments →
              </Button>
            </Link>
          </div>
        </div>

      </div>

      {/* University Notices Oversight */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <AdminNoticesManagement role="ADMIN" />
      </div>

      <section className="border-t border-slate-200 pt-6">
        <EmailTemplateSettings />
      </section>

      {/* Department Remarks Oversight */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <DepartmentRemarksOversight label="University-wide Remarks Oversight" />
      </div>

    </div>
  );
}