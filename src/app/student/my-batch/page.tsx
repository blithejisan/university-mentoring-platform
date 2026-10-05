import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { BatchNoticeboard } from "@/components/batch-noticeboard";

export default async function StudentMyBatchPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "STUDENT" && session.role !== "MENTOR") redirect("/");
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { status: true, studentProfile: { select: { userId: true } } },
  });
  if (user?.status !== "ACTIVE" || !user.studentProfile) redirect("/");

  return <BatchNoticeboard />;
}
