import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { BatchList } from "@/components/batch-management";

export default async function AdminBatchesPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-7">
      <div className="flex flex-col items-start justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-[#34724f]">Admin portal</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight text-slate-900">Batch &amp; Assignment Management</h1>
        </div>
      </div>

      <BatchList userRole="ADMIN" />
    </div>
  );
}
