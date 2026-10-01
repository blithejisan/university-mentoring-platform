"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSafeRedirectPath } from "@/lib/auth/redirect";

const ROLE_HOME: Record<string, string> = {
  ADMIN: "/admin/dashboard",
  MENTOR: "/mentor/dashboard",
  MODERATOR: "/moderator/dashboard",
  STUDENT: "/student/dashboard",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [universityIdNumber, setUniversityIdNumber] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ universityIdNumber, password, rememberMe }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Login failed.");
        return;
      }

      if (data.user.role === "MENTOR" && data.user.status === "PENDING_APPROVAL") {
        router.push("/pending-approval");
        return;
      }

      const next = getSafeRedirectPath(searchParams.get("next"));
      router.push(next ?? ROLE_HOME[data.user.role] ?? "/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[440px]">
      <div className="mb-7 flex flex-col items-center space-y-3 text-center sm:mb-8">
        <div className="relative size-14 overflow-hidden rounded-xl border border-[#dce5dc] bg-white p-2 shadow-sm">
          <Image
            src="/gub-logo.png"
            alt="Green University Logo"
            fill
            sizes="56px"
            className="object-contain p-2"
          />
        </div>

        <span className="rounded-full border border-[#cfe1d2] bg-[#eaf3e9] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#276244]">
          Welcome, Greenian!
        </span>

        <h1 className="max-w-[26rem] text-2xl font-bold leading-tight text-[#183c30] sm:text-[28px]">
          Mentor & Student Management Platform
        </h1>

        <p className="max-w-sm text-sm leading-relaxed text-[#56665d]">
          Your unified digital space for mentoring, student support, attendance, performance &amp; academic communication.
        </p>
      </div>

      <Card className="rounded-2xl border-[#dce5dc] bg-white p-0 shadow-[0_16px_44px_rgba(26,54,38,0.09)]">
        <CardHeader className="mb-0 px-6 pb-4 pt-6 sm:px-7 sm:pt-7">
          <CardTitle className="text-xl font-semibold text-[#203b2f]">Log in</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 sm:px-7 sm:pb-7">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="universityIdNumber" className="text-sm font-medium text-[#33483c]">
                Student / University ID
              </Label>
              <Input
                id="universityIdNumber"
                value={universityIdNumber}
                onChange={(e) => setUniversityIdNumber(e.target.value)}
                placeholder="e.g. 251035042"
                required
                autoFocus
                className="h-11 rounded-lg border-[#cbd8ce] bg-white text-sm text-[#203b2f] placeholder:text-[#819087] focus-visible:border-[#397553] focus-visible:ring-[#397553]/25"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-[#33483c]">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 rounded-lg border-[#cbd8ce] bg-white text-sm text-[#203b2f] focus-visible:border-[#397553] focus-visible:ring-[#397553]/25"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
              <label className="flex items-center gap-2 text-sm text-[#56665d]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="size-4 rounded border-[#aebdb1] accent-[#236543]"
                />
                Remember me
              </label>
              <Link href="/forgot-password" className="text-sm font-medium text-[#236543] underline-offset-4 hover:underline">
                Forgot password?
              </Link>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <Button type="submit" disabled={loading} className="mt-1 h-11 rounded-lg bg-[#21613f] text-sm font-semibold text-white shadow-sm hover:bg-[#194f33]">
              {loading ? "Logging in…" : "Log in"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-[#596a60]">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-semibold text-[#236543] underline-offset-4 hover:underline">
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}


export default function LoginPage() {
  return (
    <Suspense fallback={<Card className="rounded-2xl border-[#dce5dc] bg-white p-8 text-center text-[#596a60] shadow-sm">Loading...</Card>}>
      <LoginForm />
    </Suspense>
  );
}
