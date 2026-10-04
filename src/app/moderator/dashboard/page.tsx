import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DepartmentAttendanceOverviewCard } from "@/components/department-attendance-overview";
import { AdminNoticesManagement } from "@/components/admin-notices-management";
import { DepartmentRemarksOversight } from "@/components/department-remarks-oversight";
import { SessionMonitoringDashboard } from "@/components/session-monitoring-dashboard";
import { BatchPerformanceReport } from "@/components/batch-performance-report";
import { ScopedUpcomingSessions } from "@/components/scoped-upcoming-sessions";

export default async function ModeratorDashboardPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "MODERATOR") redirect("/");

  const modProfile = await prisma.moderatorProfile.findUnique({
    where: { userId: session.sub },
    select: { departmentId: true },
  });

  return (
    <div className="page-enter mx-auto flex w-full max-w-7xl flex-col gap-7">
      <div className="ai-neural-hero flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-700 bg-slate-900/75 p-5 backdrop-blur-md sm:flex-row sm:items-center sm:p-6">
        <div>
          <p className="text-sm font-medium text-cyan-300">Moderator portal</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight text-slate-900">Department Dashboard</h1>
        </div>
      </div>

      <DepartmentAttendanceOverviewCard />

      <section id="sessions" className="scroll-mt-4 space-y-7">
        <SessionMonitoringDashboard role="MODERATOR" />
        <ScopedUpcomingSessions role="MODERATOR" />
      </section>
      <section id="batch-performance" className="scroll-mt-4">
        <BatchPerformanceReport role="MODERATOR" />
      </section>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card className="ai-neon-card">
          <CardHeader>
            <CardTitle>Mentor Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Review pending mentor applications for your department.
            </p>
            <Link href="/moderator/mentors/pending" className="text-sm font-medium text-primary hover:underline">
              View pending mentors →
            </Link>
          </CardContent>
        </Card>

        <Card className="ai-neon-card">
          <CardHeader>
            <CardTitle>Department Batches</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Create batches, assign mentors, and manage student batch enrollments.
            </p>
            <Link href="/moderator/batches" className="text-sm font-medium text-primary hover:underline">
              Manage department batches →
            </Link>
          </CardContent>
        </Card>
      </div>

      <div id="notices" className="scroll-mt-4 border-t border-slate-200 pt-6">
        <AdminNoticesManagement
          role="MODERATOR"
          scopedDepartmentId={modProfile?.departmentId}
        />
      </div>

      <div className="border-t border-slate-200 pt-6">
        <DepartmentRemarksOversight label="Department Remarks Oversight" />
      </div>
    </div>
  );
}
