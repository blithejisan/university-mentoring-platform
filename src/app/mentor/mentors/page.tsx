import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { MentorDirectory } from "@/components/mentor-directory";

export default async function MentorDirectoryPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "MENTOR") redirect("/");

  const mentor = await prisma.mentorProfile.findUnique({ where: { userId: session.sub } });
  if (mentor?.approvalStatus !== "APPROVED") redirect("/pending-approval");

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-sm font-medium text-[#34724f]">Department directory</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Mentors</h1>
        <p className="mt-1 text-sm text-slate-600">Browse approved mentor contacts in your department.</p>
      </header>
      <MentorDirectory role="MENTOR" />
    </div>
  );
}