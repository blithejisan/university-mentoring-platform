import { redirect } from "next/navigation";
import { StudentIdentifySearch } from "@/components/student-identify";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function StudentIdentifyPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!["ADMIN", "MODERATOR", "MENTOR"].includes(session.role)) redirect("/");
  if (session.role === "MENTOR") {
    const mentor = await prisma.mentorProfile.findUnique({
      where: { userId: session.sub },
      select: { approvalStatus: true },
    });
    if (mentor?.approvalStatus !== "APPROVED") redirect("/pending-approval");
  }

  return (
    <div className="page-enter mx-auto flex w-full max-w-7xl flex-col gap-7">
      <header className="border-b border-slate-700/70 pb-5">
        <p className="text-sm font-medium text-teal-300">Student directory</p>
        <h1 className="mt-1 text-2xl font-semibold leading-tight text-slate-50 sm:text-3xl">
          Student Identify
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
          Find an active student by their university ID or name and view their contact and batch details.
        </p>
      </header>
      <StudentIdentifySearch />
    </div>
  );
}
