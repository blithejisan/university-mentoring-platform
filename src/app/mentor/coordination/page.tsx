import { redirect } from "next/navigation";
import { CoordinationHub } from "@/components/coordination-hub";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function MentorCoordinationPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "MENTOR") redirect("/");

  const profile = await prisma.mentorProfile.findUnique({
    where: { userId: session.sub },
    select: { approvalStatus: true },
  });
  if (profile?.approvalStatus !== "APPROVED") redirect("/pending-approval");

  return <CoordinationHub role="MENTOR" />;
}
