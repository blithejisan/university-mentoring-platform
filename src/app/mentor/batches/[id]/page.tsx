import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { BatchDetailsView } from "@/components/batch-details";

export default async function MentorBatchDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "MENTOR") redirect("/");

  const profile = await prisma.mentorProfile.findUnique({ where: { userId: session.sub } });
  if (profile?.approvalStatus !== "APPROVED") redirect("/pending-approval");

  const { id } = await params;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-7">
      <div className="border-b border-slate-200 pb-5">
        <div>
          <p className="text-sm font-medium text-[#34724f]">Mentor portal</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight text-slate-900">Batch Details</h1>
        </div>
      </div>

      <BatchDetailsView batchId={id} userRole="MENTOR" />
    </div>
  );
}
