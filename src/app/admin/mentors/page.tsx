import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { MentorDirectory } from "@/components/mentor-directory";

export default async function AdminMentorDirectoryPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-sm font-medium text-[#34724f]">University directory</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Mentors</h1>
        <p className="mt-1 text-sm text-slate-600">Browse approved mentor contacts across departments.</p>
      </header>
      <MentorDirectory role="ADMIN" />
    </div>
  );
}