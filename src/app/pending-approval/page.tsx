import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PendingApprovalPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!(session.role === "MENTOR" && session.status === "PENDING_APPROVAL")) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Awaiting approval</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-foreground">
            Your email is verified. Your mentor account is now waiting for review
            by an administrator or your department moderator. You&apos;ll receive
            an email once a decision is made, and you can log in again after
            that to check your status.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
