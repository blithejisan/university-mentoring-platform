import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MentorApprovalQueue } from "@/components/mentor-approval-queue";

export default async function AdminPendingMentorsPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-7">
      <div>
        <Link href="/admin/dashboard" className="text-sm font-medium text-[#34724f] hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Pending mentor applications
        </h1>
        <p className="text-sm text-slate-600">All departments.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Review queue</CardTitle>
        </CardHeader>
        <CardContent>
          <MentorApprovalQueue />
        </CardContent>
      </Card>
    </div>
  );
}
