"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LogoutButtonProps {
  className?: string;
  showIcon?: boolean;
}

export function LogoutButton({ className, showIcon = false }: LogoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" className={className} onClick={handleLogout} disabled={loading}>
      {showIcon && !loading && <LogOut className="size-4" aria-hidden="true" />}
      {loading ? "Logging out…" : "Log out"}
    </Button>
  );
}
