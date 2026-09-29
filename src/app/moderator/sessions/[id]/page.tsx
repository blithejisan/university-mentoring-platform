import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AttendanceSheet } from "@/components/attendance-sheet";

export default async function ModeratorSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "MODERATOR") redirect("/");

  const { id } = await params;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-7">
      <div className="border-b border-slate-200 pb-5">
        <div>
          <p className="text-sm font-medium text-[#34724f]">Moderator portal</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight text-slate-900">Session Attendance Sheet</h1>
        </div>
      </div>

      <AttendanceSheet sessionId={id} userRole="MODERATOR" />
    </div>
  );
}
