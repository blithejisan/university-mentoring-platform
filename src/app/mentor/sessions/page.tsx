import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { listBatches } from "@/lib/services/batch";
import { SessionList } from "@/components/session-management";
import { Card, CardContent } from "@/components/ui/card";

export default async function MentorSessionsPage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (actor.role !== "MENTOR") redirect("/");

  const profile = await prisma.mentorProfile.findUnique({
    where: { userId: actor.sub },
    select: { approvalStatus: true },
  });
  if (profile?.approvalStatus !== "APPROVED") redirect("/pending-approval");

  const batches = await listBatches(actor);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-7">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-sm font-medium text-[#34724f]">Mentor portal</p>
        <h1 className="mt-1 text-2xl font-semibold leading-tight text-slate-900">Mentoring Sessions</h1>
        <p className="mt-1 text-sm text-slate-600">Schedule and manage sessions for your assigned batches.</p>
      </header>

      {batches.length === 0 ? (
        <Card>
          <CardContent className="py-7 text-center text-sm text-muted-foreground">
            No batches are currently assigned to you.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {batches.map((batch) => (
            <section key={batch.id} className="space-y-4 border-b border-slate-200 pb-7 last:border-b-0">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">{batch.department.name}</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">{batch.name}</h2>
                </div>
                <Link
                  href={`/mentor/batches/${batch.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Open batch details
                </Link>
              </div>
              <SessionList batchId={batch.id} userRole="MENTOR" />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
