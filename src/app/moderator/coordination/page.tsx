import { redirect } from "next/navigation";
import { CoordinationHub } from "@/components/coordination-hub";
import { getCurrentUser } from "@/lib/auth/session";

export default async function ModeratorCoordinationPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "MODERATOR") redirect("/");

  return <CoordinationHub role="MODERATOR" />;
}
