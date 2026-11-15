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
import { DashboardOverview } from "@/components/dashboard-overview";
import { CalendarDays, Layers3, UserRound, UsersRound } from "lucide-react";

export default async function ModeratorDashboardPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "MODERATOR") redirect("/");

  const modProfile = await prisma.moderatorProfile.findUnique({
    where: { userId: session.sub },
    select: {
      departmentId: true,
      department: {
        select: {
          name: true,
          university: { select: { name: true } },
        },
      },
    },
  });
  const moderator = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { name: true },
  });
  const now = new Date();
  const metrics = modProfile
    ? await Promise.all([
        prisma.studentProfile.count({
          where: {
            departmentId: modProfile.departmentId,
            user: { status: "ACTIVE" },
          },
        }),
        prisma.batch.count({
          where: { departmentId: modProfile.departmentId, status: "ACTIVE" },
        }),
        prisma.mentorProfile.count({
          where: {
            departmentId: modProfile.departmentId,
            approvalStatus: "APPROVED",
            user: { status: "ACTIVE" },
          },
        }),
        prisma.attendanceSession.count({
          where: {
            status: "SCHEDULED",
            date: { gte: now },
            batch: { departmentId: modProfile.departmentId },
          },
        }),
      ])
    : [0, 0, 0, 0];

  return (
    <div className="page-enter mx-auto flex w-full max-w-7xl flex-col gap-7">
      <DashboardOverview
        role="Moderator"
        name={moderator?.name ?? null}
        universityName={modProfile?.department.university.name ?? null}
        departmentName={modProfile?.department.name ?? null}
        description="Keep your department's mentoring, batches, and student support moving forward."
        metrics={[
          { label: "Active students", value: metrics[0], Icon: UsersRound, tone: "cyan" },
          { label: "Active batches", value: metrics[1], Icon: Layers3, tone: "violet" },
          { label: "Approved mentors", value: metrics[2], Icon: UserRound, tone: "teal" },
          { label: "Upcoming sessions", value: metrics[3], Icon: CalendarDays, tone: "amber" },
        ]}
      />

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
