import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

const ROLE_HOME: Record<string, string> = {
  ADMIN: "/admin/dashboard",
  MENTOR: "/mentor/dashboard",
  MODERATOR: "/moderator/dashboard",
  STUDENT: "/student/dashboard",
};

export default async function HomePage() {
  const session = await getCurrentUser();

  if (!session) redirect("/login");
  if (session.role === "MENTOR" && session.status === "PENDING_APPROVAL") {
    redirect("/pending-approval");
  }
  redirect(ROLE_HOME[session.role] ?? "/login");
}
