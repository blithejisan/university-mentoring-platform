import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { BatchList } from "@/components/batch-management";

export default async function StudentBatchesPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "STUDENT") redirect("/");

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-sm font-medium text-[#34724f]">Student directory</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Department Batches</h1>
        <p className="mt-1 text-sm text-slate-600">Browse batches and their assigned mentors in your department.</p>
      </header>
      <BatchList userRole="STUDENT" />
    </div>
  );
}