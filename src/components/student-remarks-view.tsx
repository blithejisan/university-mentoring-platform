"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Clock3, Info, ChevronRight } from "lucide-react";
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

function RemarkDetailDialog({ remark, open, onClose }: { remark: Remark | null; open: boolean; onClose: () => void }) {
  if (!remark) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            {STATUS_ICONS[remark.status]}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[remark.status]}`}>
              {STATUS_LABELS[remark.status]}
            </span>
          </div>
          <DialogTitle>{remark.type}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Description</p>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{remark.description}</p>
          </div>

          {remark.status === "RESOLVED" && remark.resolutionNote && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Resolution Note</p>
              <p className="text-sm text-green-900 leading-relaxed whitespace-pre-wrap">{remark.resolutionNote}</p>
            </div>
          )}

          <div className="border-t pt-3 space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Batch</span>
              <span className="font-medium text-foreground">{remark.batch.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Issued by</span>
              <span className="font-medium text-foreground">{remark.mentor.universityIdNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Date</span>
              <span className="font-medium text-foreground">
                {new Date(remark.createdAt).toLocaleString()}
              </span>
            </div>
            {remark.resolvedAt && remark.resolvedBy && (
              <div className="flex justify-between">
                <span>Resolved by</span>
                <span className="font-medium text-foreground">
                  {remark.resolvedBy.universityIdNumber} on {new Date(remark.resolvedAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function StudentRemarksView() {
  const [remarks, setRemarks] = useState<Remark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRemark, setSelectedRemark] = useState<Remark | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchRemarks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/remarks");
      if (!res.ok) throw new Error("Failed to load remarks.");
      const json = await res.json();
      setRemarks(json.remarks ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load remarks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRemarks(); }, [fetchRemarks]);

  const handleOpen = (r: Remark) => {
    setSelectedRemark(r);
    setDialogOpen(true);
  };

  const open = remarks.filter((r) => r.status === "OPEN");
  const inReview = remarks.filter((r) => r.status === "IN_REVIEW");
  const resolved = remarks.filter((r) => r.status === "RESOLVED");

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-orange-500" />
            My Remarks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading remarks...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-orange-500" />
            My Remarks / Objections
            {(open.length + inReview.length) > 0 && (
              <span className="ml-auto text-xs font-medium bg-orange-100 text-orange-700 rounded-full px-2 py-0.5">
                {open.length + inReview.length} pending
              </span>
            )}
          </CardTitle>
          <CardDescription>Remarks and objections issued by your mentor.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <p className="text-sm text-red-500">{error}</p>}

          {remarks.length === 0 && !error && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="rounded-full bg-slate-100 p-3 text-slate-600"><Info className="size-5" /></span>
              <p className="text-sm font-medium text-slate-700">No remarks issued to you.</p>
            </div>
          )}

          {[...open, ...inReview].map((r) => (
            <div
              key={r.id}
              className="border rounded-lg p-4 hover:bg-muted/40 transition-colors cursor-pointer group"
              onClick={() => handleOpen(r)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && handleOpen(r)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {STATUS_ICONS[r.status]}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                    <span className="text-xs text-muted-foreground">· {r.batch.name}</span>
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">{r.type}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors mt-1" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {new Date(r.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}

          {resolved.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mt-4 mb-2 uppercase tracking-wide">
                Resolved
              </p>
              {resolved.map((r) => (
                <div
                  key={r.id}
                  className="border rounded-lg p-4 hover:bg-muted/40 transition-colors cursor-pointer opacity-70 group"
                  onClick={() => handleOpen(r)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && handleOpen(r)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="size-4 text-green-500" />
                        <span className="text-xs text-muted-foreground">{r.batch.name}</span>
                      </div>
                      <p className="text-sm font-medium">{r.type}</p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RemarkDetailDialog
        remark={selectedRemark}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}

// Suppress unused import
void Button;
