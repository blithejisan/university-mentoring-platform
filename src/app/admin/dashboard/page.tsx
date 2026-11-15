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
import { DashboardOverview } from "@/components/dashboard-overview";
import { CalendarDays, Layers3, UserRound, UsersRound } from "lucide-react";

export default async function AdminDashboardPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  const admin = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      name: true,
      universityId: true,
      university: { select: { name: true } },
    },
  });
  const departments = admin
    ? await prisma.department.findMany({
        where: { universityId: admin.universityId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];
  const now = new Date();
  const metrics = admin
    ? await Promise.all([
        prisma.studentProfile.count({
          where: { user: { universityId: admin.universityId, status: "ACTIVE" } },
        }),
        prisma.batch.count({
          where: { department: { universityId: admin.universityId }, status: "ACTIVE" },
        }),
        prisma.mentorProfile.count({
          where: {
            approvalStatus: "APPROVED",
            user: { universityId: admin.universityId, status: "ACTIVE" },
          },
        }),
        prisma.attendanceSession.count({
          where: {
            status: "SCHEDULED",
            date: { gte: now },
            batch: { department: { universityId: admin.universityId } },
          },
        }),
      ])
    : [0, 0, 0, 0];

  return (
    <div className="page-enter space-y-7">
      <DashboardOverview
        role="Admin"
        name={admin?.name ?? null}
        universityName={admin?.university.name ?? null}
        departmentName={departments.length === 1 ? departments[0].name : null}
        description="A clear view of batches, mentoring activity, and university-wide student support."
        metrics={[
          { label: "Active students", value: metrics[0], Icon: UsersRound, tone: "cyan" },
          { label: "Active batches", value: metrics[1], Icon: Layers3, tone: "violet" },
          { label: "Approved mentors", value: metrics[2], Icon: UserRound, tone: "teal" },
          { label: "Upcoming sessions", value: metrics[3], Icon: CalendarDays, tone: "amber" },
        ]}
      />

      <section id="sessions" className="scroll-mt-4 space-y-7">
        <SessionMonitoringDashboard role="ADMIN" />
        <ScopedUpcomingSessions role="ADMIN" />
      </section>
      <DepartmentAttendanceOverviewCard departments={departments} />
      <section id="batch-performance" className="scroll-mt-4">
        <BatchPerformanceReport role="ADMIN" />
      </section>

      {/* Quick Action Navigation Cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        
        {/* Card 1: Mentor Applications */}
        <div className="ai-neon-card group flex flex-col justify-between rounded-xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08),0_0_14px_rgba(33,97,63,0.07)] sm:p-6">
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
        <div className="ai-neon-card group flex flex-col justify-between rounded-xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08),0_0_14px_rgba(33,97,63,0.07)] sm:p-6">
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
      <div id="notices" className="scroll-mt-4 space-y-4 rounded-xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur-md sm:p-6">
        <AdminNoticesManagement role="ADMIN" />
      </div>

      <section className="border-t border-slate-200 pt-6">
        <EmailTemplateSettings />
      </section>

      {/* Department Remarks Oversight */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur-md sm:p-6">
        <DepartmentRemarksOversight label="University-wide Remarks Oversight" />
      </div>

    </div>
  );
}