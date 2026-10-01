"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PasswordField = "currentPassword" | "newPassword" | "confirmPassword";

const passwordFields: { name: PasswordField; label: string; autocomplete: string }[] = [
  { name: "currentPassword", label: "Current password", autocomplete: "current-password" },
  { name: "newPassword", label: "New password", autocomplete: "new-password" },
  { name: "confirmPassword", label: "Confirm new password", autocomplete: "new-password" },
];

function getPasswordChecks(password: string) {
  return [
    { label: "At least 8 characters", passed: password.length >= 8 },
    { label: "A lowercase letter", passed: /[a-z]/.test(password) },
    { label: "An uppercase letter", passed: /[A-Z]/.test(password) },
    { label: "A number", passed: /[0-9]/.test(password) },
    { label: "A special character", passed: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function PasswordChangeForm() {
  const router = useRouter();
  const [passwords, setPasswords] = useState<Record<PasswordField, string>>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [visible, setVisible] = useState<Record<PasswordField, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const checks = getPasswordChecks(passwords.newPassword);
  const strength = checks.filter((check) => check.passed).length;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwords),
      });
      const data = await response.json();
      if (!response.ok) {
        setFeedback({ type: "error", message: data.error ?? "Unable to update your password." });
        return;
      }

      setFeedback({ type: "success", message: data.message });
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      window.setTimeout(() => {
        router.replace("/login");
        router.refresh();
      }, 1800);
    } catch {
      setFeedback({ type: "error", message: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {passwordFields.map(({ name, label, autocomplete }) => (
          <div key={name} className="flex flex-col gap-1.5">
            <Label htmlFor={name} className="text-sm font-medium text-[#33483c]">{label}</Label>
            <div className="relative">
              <Input
                id={name}
                type={visible[name] ? "text" : "password"}
                value={passwords[name]}
                onChange={(event) => setPasswords((current) => ({ ...current, [name]: event.target.value }))}
                autoComplete={autocomplete}
                required
                maxLength={72}
                className="h-11 rounded-lg border-[#cbd8ce] bg-white pr-11 text-sm text-[#203b2f] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
              />
              <button
                type="button"
                aria-label={visible[name] ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
                aria-pressed={visible[name]}
                onClick={() => setVisible((current) => ({ ...current, [name]: !current[name] }))}
                className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-lg text-[#64766a] transition-colors hover:text-[#205b3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50"
              >
                {visible[name] ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
              </button>
            </div>
          </div>
        ))}

        <div aria-live="polite" className="space-y-2">
          <div className="flex gap-1" aria-label={`Password strength: ${strength} of 5 requirements met`}>
            {checks.map((check) => (
              <span
                key={check.label}
                className={`h-1.5 flex-1 rounded-full transition-colors ${check.passed ? "bg-emerald-500" : "bg-slate-200"}`}
              />
            ))}
          </div>
          <ul className="grid gap-x-3 gap-y-1 text-xs text-slate-600 sm:grid-cols-2">
            {checks.map((check) => (
              <li key={check.label} className={check.passed ? "text-emerald-700" : ""}>
                <span aria-hidden="true">{check.passed ? "✓" : "•"} </span>{check.label}
              </li>
            ))}
          </ul>
        </div>

        <Button
          type="submit"
          disabled={loading || strength !== 5 || passwords.newPassword !== passwords.confirmPassword}
          className="mt-1 h-11 rounded-lg bg-[#21613f] text-sm font-semibold text-white shadow-sm hover:bg-[#194f33]"
        >
          <LockKeyhole aria-hidden="true" className="mr-2 size-4" />
          {loading ? "Updating password…" : "Update password"}
        </Button>
      </form>

      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={`fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-md ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50/95 text-emerald-800"
              : "border-red-200 bg-red-50/95 text-red-800"
          }`}
        >
          {feedback.message}
        </div>
      )}
    </>
  );
}
