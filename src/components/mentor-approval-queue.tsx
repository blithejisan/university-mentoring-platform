"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PendingMentor = {
  userId: string;
  universityIdNumber: string;
  email: string;
  departmentId: string;
  departmentName: string;
  registeredAt: string;
};

export function MentorApprovalQueue() {
  const [mentors, setMentors] = useState<PendingMentor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingMentor | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/mentors/pending");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not load pending mentors.");
      return;
    }
    setError(null);
    setMentors(data.mentors);
  }

  useEffect(() => {
    // Standard fetch-on-mount: load() only touches state after its
    // await, so no synchronous cascading render actually happens here —
    // the lint rule can't see past the function boundary to confirm that.
    load();
  }, []);

  async function handleApprove(mentor: PendingMentor) {
    setActingOn(mentor.userId);
    setError(null);
    try {
      const res = await fetch(`/api/mentors/${mentor.userId}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not approve this mentor.");
        return;
      }
      setMentors((prev) => prev?.filter((m) => m.userId !== mentor.userId) ?? null);
    } finally {
      setActingOn(null);
    }
  }

  function openRejectDialog(mentor: PendingMentor) {
    setRejectTarget(mentor);
    setRejectReason("");
    setRejectError(null);
  }

  async function handleReject() {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      setRejectError("A rejection reason is required.");
      return;
    }

    setActingOn(rejectTarget.userId);
    try {
      const res = await fetch(`/api/mentors/${rejectTarget.userId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRejectError(data.error ?? "Could not reject this mentor.");
        return;
      }
      setMentors((prev) => prev?.filter((m) => m.userId !== rejectTarget.userId) ?? null);
      setRejectTarget(null);
    } finally {
      setActingOn(null);
    }
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (mentors === null) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (mentors.length === 0) {
    return <p className="text-sm text-muted-foreground">No pending mentor applications.</p>;
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {mentors.map((mentor) => (
          <Card key={mentor.userId}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">{mentor.universityIdNumber}</p>
                <p className="text-sm text-muted-foreground">{mentor.email}</p>
                <p className="text-xs text-muted-foreground">
                  {mentor.departmentName} · Registered{" "}
                  {new Date(mentor.registeredAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openRejectDialog(mentor)}
                  disabled={actingOn === mentor.userId}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleApprove(mentor)}
                  disabled={actingOn === mentor.userId}
                >
                  {actingOn === mentor.userId ? "Working…" : "Approve"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject mentor application</DialogTitle>
            <DialogDescription>
              {rejectTarget?.universityIdNumber} will receive an email with the reason
              you provide.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Explain why this application is being rejected…"
            rows={4}
            autoFocus
          />
          {rejectError && <p className="text-sm text-destructive">{rejectError}</p>}

          <DialogFooter>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actingOn === rejectTarget?.userId}
            >
              {actingOn === rejectTarget?.userId ? "Rejecting…" : "Confirm rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
