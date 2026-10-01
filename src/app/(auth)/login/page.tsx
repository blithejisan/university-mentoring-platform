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
import { Eye, EyeOff } from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);
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
        <div className="relative size-14 overflow-hidden rounded-xl border border-slate-700 bg-slate-800 p-2 shadow-sm">
          <Image
            src="/gub-logo.png"
            alt="Green University Logo"
            fill
            sizes="56px"
            className="object-contain p-2"
          />
        </div>

        <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-100">
          Welcome, Greenian!
        </span>

        <h1 className="max-w-[26rem] text-2xl font-bold leading-tight text-slate-100 sm:text-[28px]">
          Mentor & Student Management Platform
        </h1>

        <p className="max-w-sm text-sm leading-relaxed text-slate-300">
          Your unified digital space for mentoring, student support, attendance, performance &amp; academic communication.
        </p>
      </div>

      <Card className="ai-neon-card rounded-2xl border-primary/20 bg-card/90 p-0 shadow-lg shadow-primary/5 backdrop-blur-md">
        <CardHeader className="mb-0 px-6 pb-4 pt-6 sm:px-7 sm:pt-7">
          <CardTitle className="text-xl font-semibold text-slate-100">Log in</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 sm:px-7 sm:pb-7">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="universityIdNumber" className="text-sm font-medium text-slate-200">
                Student / University ID
              </Label>
              <Input
                id="universityIdNumber"
                value={universityIdNumber}
                onChange={(e) => setUniversityIdNumber(e.target.value)}
                placeholder="e.g. 251035042"
                required
                autoFocus
                className="h-11 rounded-lg border-slate-600 bg-slate-900/70 text-sm text-slate-100 placeholder:text-slate-400 focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/40"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-slate-200">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 rounded-lg border-slate-600 bg-slate-900/70 pr-11 text-sm text-slate-100 focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/40"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-lg text-slate-400 transition-colors hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400/50"
                >
                  {showPassword ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="size-4 rounded border-slate-500 accent-cyan-400"
                />
                Remember me
              </label>
              <Link href="/forgot-password" className="text-sm font-medium text-cyan-200 underline-offset-4 hover:underline">
                Forgot password?
              </Link>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <Button type="submit" disabled={loading} className="mt-1 h-11 rounded-lg bg-cyan-700 text-sm font-semibold text-white shadow-sm hover:bg-cyan-600">
              {loading ? "Logging in…" : "Log in"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-300">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-semibold text-cyan-200 underline-offset-4 hover:underline">
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
    <Suspense fallback={<Card className="ai-neon-card rounded-2xl border-slate-700 bg-slate-900/75 p-8 text-center text-slate-300 shadow-sm backdrop-blur-md">Loading...</Card>}>
      <LoginForm />
    </Suspense>
  );
}
