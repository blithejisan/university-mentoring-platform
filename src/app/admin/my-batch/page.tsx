import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { BatchNoticeboard } from "@/components/batch-noticeboard";

export default async function AdminMyBatchPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  return <BatchNoticeboard isAdmin />;
}
