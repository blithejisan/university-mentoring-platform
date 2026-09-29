import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { BatchList } from "@/components/batch-management";

export default async function MentorBatchesPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "MENTOR") redirect("/");

  const profile = await prisma.mentorProfile.findUnique({ where: { userId: session.sub } });
  if (profile?.approvalStatus !== "APPROVED") redirect("/pending-approval");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-7">
      <div className="flex flex-col items-start justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-[#34724f]">Mentor portal</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight text-slate-900">Department Batches</h1>
        </div>
      </div>

      <BatchList userRole="MENTOR" />
    </div>
  );
}
