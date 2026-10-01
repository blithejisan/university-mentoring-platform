import { redirect } from "next/navigation";
import { BadgeCheck, Mail, UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordChangeForm } from "@/components/profile/password-change-form";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const roleLabels: Record<string, string> = {
  ADMIN: "Administrator",
  MODERATOR: "Moderator",
  MENTOR: "Mentor",
  STUDENT: "Student",
};

export default async function ProfilePage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      name: true,
      email: true,
      universityIdNumber: true,
      role: true,
      studentProfile: { select: { department: { select: { name: true } } } },
      mentorProfile: { select: { department: { select: { name: true } } } },
      moderatorProfile: { select: { department: { select: { name: true } } } },
    },
  });
  if (!user) redirect("/login");

  const department =
    user.studentProfile?.department.name ??
    user.mentorProfile?.department.name ??
    user.moderatorProfile?.department.name ??
    null;

  const details = [
    { label: "Name", value: user.name || "Not provided", icon: UserRound },
    { label: "Email", value: user.email, icon: Mail },
    { label: "Student / University ID", value: user.universityIdNumber, icon: BadgeCheck },
    { label: "Department", value: department ?? "Not assigned", icon: null },
  ];

  return (
    <div className="page-enter mx-auto flex w-full max-w-5xl flex-col gap-7">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-sm font-medium text-[#34724f]">Account settings</p>
        <h1 className="mt-1 text-2xl font-semibold leading-tight text-slate-900">Profile &amp; Security</h1>
        <p className="mt-2 text-sm text-slate-600">Review your profile information and keep your account secure.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Card className="ai-neon-card border-slate-200 bg-white/90 shadow-sm backdrop-blur-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-slate-900">Profile details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-3 rounded-lg border border-[#dce8d8] bg-[#f5f8f3] p-4">
              <span className="flex size-11 items-center justify-center rounded-full bg-[#e3efe4] text-[#236543]">
                <UserRound aria-hidden="true" className="size-5" />
              </span>
              <div>
                <p className="font-semibold text-[#203b2f]">{user.name || "Account holder"}</p>
                <span className="mt-1 inline-flex rounded-full border border-[#cfe1d2] bg-white px-2.5 py-0.5 text-xs font-semibold text-[#205b3d]">
                  {roleLabels[user.role] ?? user.role}
                </span>
              </div>
            </div>

            <dl className="divide-y divide-slate-100">
              {details.map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  {Icon ? <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#568166]" /> : <span className="mt-0.5 size-4 shrink-0" />}
                  <div className="min-w-0">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
                    <dd className="mt-0.5 break-words text-sm font-medium text-slate-800">{value}</dd>
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-3 py-3">
                <BadgeCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#568166]" />
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Role</dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-800">{roleLabels[user.role] ?? user.role}</dd>
                </div>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="ai-neon-card border-slate-200 bg-white/90 shadow-sm backdrop-blur-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-slate-900">Security</CardTitle>
            <p className="text-sm text-slate-600">Choose a unique password with uppercase, lowercase, number, and special characters.</p>
          </CardHeader>
          <CardContent>
            <PasswordChangeForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
