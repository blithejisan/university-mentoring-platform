import { redirect } from "next/navigation";
import { StudentSessionEvaluations } from "@/components/student-session-evaluations";
import { getCurrentUser } from "@/lib/auth/session";

export default async function StudentEvaluationsPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "STUDENT") redirect("/");

  return (
    <div className="page-enter mx-auto flex w-full max-w-7xl flex-col gap-7">
      <div className="ai-neural-hero rounded-2xl border border-slate-700 bg-slate-900/75 p-5 backdrop-blur-md sm:p-6">
        <p className="text-sm font-medium text-cyan-300">Student portal</p>
        <h1 className="mt-1 text-2xl font-semibold leading-tight text-slate-900">
          Mentor Evaluation
        </h1>
        <p className="mt-2 text-sm text-slate-200">
          Share anonymous feedback about your completed mentoring sessions.
        </p>
      </div>
      <StudentSessionEvaluations />
    </div>
  );
}
