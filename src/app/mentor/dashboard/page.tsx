import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MentorEvaluationsDashboard } from "@/components/mentor-evaluations-dashboard";
import { MentorNoticesManagement } from "@/components/mentor-notices-management";
import { MentorRemarksManagement } from "@/components/mentor-remarks-management";
import { BatchPerformanceReport } from "@/components/batch-performance-report";

export default async function MentorDashboardPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "MENTOR") redirect("/");

  const profile = await prisma.mentorProfile.findUnique({ where: { userId: session.sub } });
  if (profile?.approvalStatus !== "APPROVED") redirect("/pending-approval");

  const assignedBatchesCount = await prisma.mentorBatch.count({
    where: { mentorId: session.sub },
  });

  return (
    <div className="page-enter mx-auto flex w-full max-w-7xl flex-col gap-7">
      <div className="ai-neural-hero flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-700 bg-slate-900/75 p-5 backdrop-blur-md sm:flex-row sm:items-center sm:p-6">
        <div>
          <p className="text-sm font-medium text-cyan-300">Mentor portal</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight text-slate-900">Dashboard</h1>
        </div>
      </div>

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
