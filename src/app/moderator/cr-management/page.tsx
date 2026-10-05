import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { AdminCRManagement } from "@/components/admin-cr-management";

export default async function ModeratorCRManagementPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "MODERATOR") redirect("/");

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <Link href="/moderator/dashboard" className="text-sm font-medium text-emerald-800 hover:underline">← Dashboard</Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Batch CR management</h1>
        <p className="mt-1 text-sm text-slate-600">Review CR requests and appoint enrolled students in your department, including mentors.</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <AdminCRManagement />
      </div>
    </div>
  );
}
