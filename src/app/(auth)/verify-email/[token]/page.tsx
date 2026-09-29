"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Status = "verifying" | "success" | "error";

export default function VerifyEmailPage() {
  const params = useParams<{ token: string }>();
  const [status, setStatus] = useState<Status>("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: params.token }),
    })
      .then(async (res) => {
        const data = await res.json();
        setStatus(res.ok ? "success" : "error");
        setMessage(data.message ?? data.error ?? "Something went wrong.");
      })
      .catch(() => {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      });
  }, [params.token]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email verification</CardTitle>
      </CardHeader>
      <CardContent>
        {status === "verifying" && (
          <p className="text-sm text-muted-foreground">Verifying your email…</p>
        )}
        {status !== "verifying" && (
          <>
            <p className={`text-sm ${status === "error" ? "text-destructive" : "text-foreground"}`}>
              {message}
            </p>
            <Link href="/login" className="mt-6 inline-block text-sm text-primary hover:underline">
              Back to login
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
