import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { BatchNoticeboard } from "@/components/batch-noticeboard";

export default async function StudentMyBatchPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "STUDENT") redirect("/");

  return <BatchNoticeboard />;
}
