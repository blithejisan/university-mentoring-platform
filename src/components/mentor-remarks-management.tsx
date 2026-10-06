"use client";
import { ThemedSelect } from "@/components/ui/themed-select";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Plus,
  AlertCircle,
  Info,
} from "lucide-react";

type RemarkStatus = "OPEN" | "IN_REVIEW" | "RESOLVED";

interface Student {
  userId: string;
  user: { universityIdNumber: string; email: string };
}

interface Batch {
  id: string;
  name: string;
  studentBatches?: Array<{ student: Student }>;
}

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

const REMARK_TYPES = [
  "Academic Performance",
  "Attendance Concern",
  "Behavioral Issue",
  "Communication Problem",
  "Assignment Incomplete",
  "Disciplinary Matter",
  "Positive Recognition",
  "Other",
];

interface CreateRemarkFormProps {
  batches: Batch[];
  onCreated: () => void;
  onCancel: () => void;
}

function CreateRemarkForm({ batches, onCreated, onCancel }: CreateRemarkFormProps) {
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState(REMARK_TYPES[0]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedBatch = batches.find((b) => b.id === batchId);
  const studentsInBatch = selectedBatch?.studentBatches?.map((sb) => sb.student) ?? [];

  useEffect(() => {
    setStudentId(studentsInBatch[0]?.userId ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId) {
      setError("Select a student.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/remarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, batchId, type, description }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create remark.");
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create remark.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="remark-batch">Batch *</Label>
          <ThemedSelect
            id="remark-batch"
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            required
          >
            {batches.length === 0 && <option value="">No batches</option>}
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </ThemedSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="remark-student">Student *</Label>
          <ThemedSelect
            id="remark-student"
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            required
          >
            {studentsInBatch.length === 0 && <option value="">No students in batch</option>}
            {studentsInBatch.map((s) => (
              <option key={s.userId} value={s.userId}>
                {s.user.universityIdNumber} — {s.user.email}
              </option>
            ))}
          </ThemedSelect>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="remark-type">Type / Category *</Label>
        <ThemedSelect
          id="remark-type"
          className="w-full border rounded-md px-3 py-2 text-sm bg-background"
          value={type}
          onChange={(e) => setType(e.target.value)}
          required
        >
          {REMARK_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </ThemedSelect>
      </div>

      <div className="space-y-1">
        <Label htmlFor="remark-description">Description *</Label>
        <Textarea
          id="remark-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the remark or issue in detail..."
          rows={5}
          minLength={10}
          maxLength={2000}
          required
        />
        <p className="text-xs text-muted-foreground">{description.length}/2000</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={loading || batches.length === 0} className="flex-1">
          {loading ? "Submitting..." : "Create Remark"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

interface UpdateStatusFormProps {
  remark: Remark;
  onUpdated: () => void;
  onCancel: () => void;
}

function UpdateStatusForm({ remark, onUpdated, onCancel }: UpdateStatusFormProps) {
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
        body: JSON.stringify({
          status,
          resolutionNote: resolutionNote || null,
        }),
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
      <div className="space-y-1">
        <Label htmlFor="update-status">Status *</Label>
        <ThemedSelect
          id="update-status"
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
        <Label htmlFor="resolution-note">
          Resolution Note {status === "RESOLVED" ? "(recommended)" : "(optional)"}
        </Label>
        <Textarea
          id="resolution-note"
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

export function MentorRemarksManagement() {
  const [remarks, setRemarks] = useState<Remark[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [updating, setUpdating] = useState<Remark | null>(null);
  const [filter, setFilter] = useState<RemarkStatus | "ALL">("ALL");
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [remarksRes, batchesRes] = await Promise.all([
        fetch("/api/remarks"),
        fetch("/api/batches"),
      ]);
      if (!remarksRes.ok || !batchesRes.ok) throw new Error("Failed to load data.");
      const [remarksJson, batchesJson] = await Promise.all([remarksRes.json(), batchesRes.json()]);
      setRemarks(remarksJson.remarks ?? []);

      // For create form, we need batch students. Fetch them per batch.
      const batchList: Batch[] = batchesJson.batches ?? [];
      const batchesWithStudents = await Promise.all(
        batchList.map(async (b: Batch) => {
          const r = await fetch(`/api/batches/${b.id}`);
          if (!r.ok) return b;
          const json = await r.json();
          return json.batch ?? b;
        })
      );
      setBatches(batchesWithStudents);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredRemarks = filter === "ALL" ? remarks : remarks.filter((r) => r.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="size-5 text-orange-500" />
            Student Remarks
          </h2>
          <p className="text-sm text-muted-foreground">Create and manage remarks for your students.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm" className="gap-1">
          <Plus className="size-4" />
          New Remark
        </Button>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(v) => !v && setShowCreate(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Remark</DialogTitle>
          </DialogHeader>
          <CreateRemarkForm
            batches={batches}
            onCreated={() => { setShowCreate(false); fetchData(); }}
            onCancel={() => setShowCreate(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={!!updating} onOpenChange={(v) => !v && setUpdating(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Remark Status</DialogTitle>
          </DialogHeader>
          {updating && (
            <UpdateStatusForm
              remark={updating}
              onUpdated={() => { setUpdating(null); fetchData(); }}
              onCancel={() => setUpdating(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["ALL", "OPEN", "IN_REVIEW", "RESOLVED"] as const).map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(s)}
          >
            {s === "ALL" ? "All" : STATUS_LABELS[s as RemarkStatus]}
          </Button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading remarks...</p>
      ) : filteredRemarks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-7 text-center">
            <span className="rounded-full bg-slate-100 p-3 text-slate-600"><Info className="size-5" /></span>
            <p className="text-sm font-medium text-slate-700">No remarks in this category.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRemarks.map((r) => (
            <div key={r.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {STATUS_ICONS[r.status]}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                    <span className="text-xs text-muted-foreground">· {r.batch.name}</span>
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">{r.type}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Student: {r.student.user.universityIdNumber}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>
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
                    onClick={() => setUpdating(r)}
                    className="shrink-0"
                  >
                    Update
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Created {new Date(r.createdAt).toLocaleDateString()}
                {r.resolvedAt && ` · Resolved ${new Date(r.resolvedAt).toLocaleDateString()}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Suppress unused
void CardDescription;
void Input;
