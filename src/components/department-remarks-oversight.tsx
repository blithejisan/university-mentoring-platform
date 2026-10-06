"use client";
import { ThemedSelect } from "@/components/ui/themed-select";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Clock3, Info, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type RemarkStatus = "OPEN" | "IN_REVIEW" | "RESOLVED";

interface Remark {
  id: string;
  type: string;
  description: string;
  status: RemarkStatus;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  student: { userId: string; user: { universityIdNumber: string; email: string } };
  mentor: { universityIdNumber: string; email: string };
  batch: { id: string; name: string };
  resolvedBy: { universityIdNumber: string; email: string; role: string } | null;
}

const STATUS_ICONS: Record<RemarkStatus, React.ReactNode> = {
  OPEN: <AlertTriangle className="size-4 text-orange-500" />,
  IN_REVIEW: <Clock3 className="size-4 text-blue-500" />,
  RESOLVED: <CheckCircle2 className="size-4 text-green-500" />,
};

const STATUS_COLORS: Record<RemarkStatus, string> = {
  OPEN: "bg-orange-100 text-orange-700",
  IN_REVIEW: "bg-blue-100 text-blue-700",
  RESOLVED: "bg-green-100 text-green-700",
};

const STATUS_LABELS: Record<RemarkStatus, string> = {
  OPEN: "Open",
  IN_REVIEW: "Under Review",
  RESOLVED: "Resolved",
};

function UpdateStatusForm({
  remark,
  onUpdated,
  onCancel,
}: {
  remark: Remark;
  onUpdated: () => void;
  onCancel: () => void;
}) {
  const [status, setStatus] = useState<RemarkStatus>(remark.status);
  const [resolutionNote, setResolutionNote] = useState(remark.resolutionNote ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/remarks/${remark.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolutionNote: resolutionNote || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update.");
      onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-muted/50 rounded-md p-3 text-sm">
        <p className="font-medium">{remark.type}</p>
        <p className="text-muted-foreground text-xs mt-1">
          Student: {remark.student.user.universityIdNumber} · Batch: {remark.batch.name}
        </p>
        <p className="text-xs mt-2 line-clamp-3">{remark.description}</p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="dept-update-status">Status *</Label>
        <ThemedSelect
          id="dept-update-status"
          className="w-full border rounded-md px-3 py-2 text-sm bg-background"
          value={status}
          onChange={(e) => setStatus(e.target.value as RemarkStatus)}
        >
          <option value="OPEN">Open</option>
          <option value="IN_REVIEW">Under Review</option>
          <option value="RESOLVED">Resolved</option>
        </ThemedSelect>
      </div>

      <div className="space-y-1">
        <Label htmlFor="dept-resolution-note">
          Resolution Note {status === "RESOLVED" ? "(recommended)" : "(optional)"}
        </Label>
        <Textarea
          id="dept-resolution-note"
          value={resolutionNote}
          onChange={(e) => setResolutionNote(e.target.value)}
          placeholder="Describe the resolution or action taken..."
          rows={4}
          maxLength={2000}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "Updating..." : "Update Status"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

interface Props {
  /** ADMIN → undefined (see all), MODERATOR → department scoped via API */
  label?: string;
}

export function DepartmentRemarksOversight({ label = "Remarks Oversight" }: Props) {
  const [remarks, setRemarks] = useState<Remark[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RemarkStatus | "ALL">("ALL");
  const [updating, setUpdating] = useState<Remark | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRemarks = useCallback(async () => {
    try {
      setLoading(true);
      const url = filter !== "ALL" ? `/api/remarks?status=${filter}` : "/api/remarks";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load remarks.");
      const json = await res.json();
      setRemarks(json.remarks ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load remarks.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchRemarks(); }, [fetchRemarks]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold leading-snug text-slate-900">
          <AlertTriangle className="size-5 text-orange-500" />
          {label}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Review and manage student remarks within your scope.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {(["ALL", "OPEN", "IN_REVIEW", "RESOLVED"] as const).map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            className={filter === s
              ? "border border-[#173b61] bg-[#173b61] text-white hover:bg-[#244f78]"
              : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"}
            onClick={() => setFilter(s)}
          >
            {s === "ALL" ? "All" : STATUS_LABELS[s as RemarkStatus]}
          </Button>
        ))}
      </div>

      <Dialog open={!!updating} onOpenChange={(v) => !v && setUpdating(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Remark Status</DialogTitle>
          </DialogHeader>
          {updating && (
            <UpdateStatusForm
              remark={updating}
              onUpdated={() => { setUpdating(null); fetchRemarks(); }}
              onCancel={() => setUpdating(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading remarks...</p>
      ) : remarks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-7 text-center">
            <span className="rounded-full bg-slate-100 p-3 text-slate-600">
              <Info className="size-5" />
            </span>
            <p className="text-sm font-medium text-slate-700">No remarks found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {remarks.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {STATUS_ICONS[r.status]}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                    <span className="text-xs text-muted-foreground">· {r.batch.name}</span>
                  </div>
                  <h3 className="text-sm font-semibold leading-snug text-slate-900">{r.type}</h3>
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    <p>Student: <span className="font-medium text-foreground">{r.student.user.universityIdNumber}</span></p>
                    <p>Mentor: <span className="font-medium text-foreground">{r.mentor.universityIdNumber}</span></p>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 line-clamp-2">{r.description}</p>
                  {r.resolutionNote && (
                    <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 mt-2 line-clamp-2">
                      Resolution: {r.resolutionNote}
                    </p>
                  )}
                </div>
                {r.status !== "RESOLVED" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setUpdating(r)}
                  >
                    Update
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {new Date(r.createdAt).toLocaleDateString()}
                {r.resolvedAt && ` · Resolved ${new Date(r.resolvedAt).toLocaleDateString()}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
