import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MentorEvaluationsDashboard } from "@/components/mentor-evaluations-dashboard";
import { MentorNoticesManagement } from "@/components/mentor-notices-management";
import { MentorRemarksManagement } from "@/components/mentor-remarks-management";
import { BatchPerformanceReport } from "@/components/batch-performance-report";
import { DashboardOverview } from "@/components/dashboard-overview";
import { CalendarDays, Layers3, UsersRound } from "lucide-react";

export default async function MentorDashboardPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "MENTOR") redirect("/");

  const profile = await prisma.mentorProfile.findUnique({
    where: { userId: session.sub },
    select: {
      approvalStatus: true,
      user: { select: { name: true } },
      department: {
        select: {
          name: true,
          university: { select: { name: true } },
        },
      },
    },
  });
  if (profile?.approvalStatus !== "APPROVED") redirect("/pending-approval");

  const now = new Date();
  const [assignedBatchesCount, activeStudentsCount, upcomingSessionsCount] =
    await Promise.all([
      prisma.mentorBatch.count({ where: { mentorId: session.sub } }),
      prisma.studentProfile.count({
        where: {
          user: { status: "ACTIVE" },
          studentBatches: {
            some: {
              leftAt: null,
              batch: { mentorBatches: { some: { mentorId: session.sub } } },
            },
          },
        },
      }),
      prisma.attendanceSession.count({
        where: {
          status: "SCHEDULED",
          date: { gte: now },
          batch: { mentorBatches: { some: { mentorId: session.sub } } },
        },
      }),
    ]);

  return (
    <div className="page-enter mx-auto flex w-full max-w-7xl flex-col gap-7">
      <DashboardOverview
        role="Mentor"
        name={profile.user.name}
        universityName={profile.department.university.name}
        departmentName={profile.department.name}
        description="Manage mentoring sessions, stay connected with your students, and follow their progress."
        metrics={[
          { label: "Assigned batches", value: assignedBatchesCount, Icon: Layers3, tone: "violet" },
          { label: "Active students", value: activeStudentsCount, Icon: UsersRound, tone: "cyan" },
          { label: "Upcoming sessions", value: upcomingSessionsCount, Icon: CalendarDays, tone: "teal" },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card className="ai-neon-card">
          <CardHeader>
            <CardTitle>Assigned Batches</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              You are currently assigned to <span className="font-semibold text-foreground">{assignedBatchesCount}</span> batch(es).
            </p>
            <Link href="/mentor/batches" className="text-sm font-medium text-primary hover:underline">
              View assigned batches &amp; students →
            </Link>
          </CardContent>
        </Card>

        <Card className="ai-neon-card">
          <CardHeader>
            <CardTitle>Mentoring Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Session scheduling, attendance tracking, and student performance.
            </p>
            <Link href="/mentor/sessions" className="text-sm font-medium text-primary hover:underline">
              Manage sessions &amp; attendance →
            </Link>
          </CardContent>
        </Card>
      </div>

      <div id="notices" className="scroll-mt-4 border-t border-slate-200 pt-6">
        <MentorNoticesManagement />
      </div>

      <div id="remarks" className="scroll-mt-4 border-t border-slate-200 pt-6">
        <MentorRemarksManagement />
      </div>

      <section id="batch-performance" className="scroll-mt-4">
        <BatchPerformanceReport role="MENTOR" />
      </section>

      <div id="my-evaluation" className="scroll-mt-4 border-t border-slate-200 pt-6">
        <MentorEvaluationsDashboard />
      </div>
    </div>
  );
}
