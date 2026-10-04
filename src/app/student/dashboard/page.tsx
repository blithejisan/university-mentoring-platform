import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { StudentAttendanceView } from "@/components/student-attendance-view";
import { StudentSessionsOverview } from "@/components/student-sessions-overview";
import { StudentPerformanceView } from "@/components/student-performance-view";
import { StudentNoticesView } from "@/components/student-notices-view";
import { StudentRemarksView } from "@/components/student-remarks-view";
import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";

export default async function StudentDashboardPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "STUDENT") redirect("/");

  const currentBatches = await prisma.studentBatch.findMany({
    where: { studentId: session.sub, leftAt: null },
    select: { batch: { select: { id: true, name: true } } },
  });

  return (
    <div className="page-enter mx-auto flex w-full max-w-7xl flex-col gap-7">
      <div className="ai-neural-hero flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-700 bg-slate-900/75 p-5 backdrop-blur-md sm:flex-row sm:items-center sm:p-6">
        <div>
          <p className="text-sm font-medium text-cyan-300">Student portal</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight text-slate-900">My Student Dashboard</h1>
        </div>
      </div>

      <section className="ai-neon-card flex flex-col gap-4 rounded-lg border border-slate-700 bg-slate-900/75 p-4 shadow-sm backdrop-blur-md transition-all duration-200 hover:border-cyan-400/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.08)] sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-cyan-400/30 bg-cyan-400/10 text-cyan-200">
            <FlaskConical aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Lab Report Generator</h2>
            <p className="mt-1 text-sm text-slate-600">Create a formatted report, then generate a PDF or download the LaTeX project.</p>
          </div>
        </div>
        <Link
          href="/student/lab-report-generator"
          className="lab-generator-link inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold"
        >
          Open generator
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </section>

      {/* Notices */}
      <div id="notices" className="scroll-mt-4">
        <StudentNoticesView />
      </div>

      <div id="sessions" className="scroll-mt-4 border-t border-slate-200 pt-6">
        <StudentSessionsOverview batches={currentBatches.map(({ batch }) => batch)} />
      </div>

      {/* Attendance */}
      <div className="border-t border-slate-200 pt-6">
        <StudentAttendanceView studentUserId={session.sub} />
      </div>

      {/* Performance */}
      <div className="border-t border-slate-200 pt-6">
        <StudentPerformanceView studentUserId={session.sub} />
      </div>

      {/* Remarks */}
      <div id="remarks" className="scroll-mt-4 border-t border-slate-200 pt-6">
        <StudentRemarksView />
      </div>
    </div>
  );
}
