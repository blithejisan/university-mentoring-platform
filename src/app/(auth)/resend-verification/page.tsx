"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ResendVerificationPage() {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Unable to send a verification link.");
        return;
      }
      setMessage(data.message);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resend verification email</CardTitle>
      </CardHeader>
      <CardContent>
        {message ? (
          <p className="text-sm text-foreground">{message}</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Enter the Student ID or personal email used during registration.
            </p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="identifier">Student ID or personal email</Label>
              <Input
                id="identifier"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? "Sending…" : "Send verification link"}
            </Button>
          </form>
        )}
        <Link href="/login" className="mt-6 inline-block text-sm text-primary hover:underline">
          Back to login
        </Link>
      </CardContent>
    </Card>
  );
}
