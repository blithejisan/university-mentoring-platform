import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { BatchDetailsView } from "@/components/batch-details";

export default async function AdminBatchDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  const { id } = await params;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-7">
      <div className="border-b border-slate-200 pb-5">
        <div>
          <p className="text-sm font-medium text-[#34724f]">Admin portal</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight text-slate-900">Batch Details</h1>
        </div>
      </div>

      <BatchDetailsView batchId={id} userRole="ADMIN" />
    </div>
  );
}
