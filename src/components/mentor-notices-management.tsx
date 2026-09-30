"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bell, Plus, Archive, Calendar, Tag, ChevronRight, AlertCircle } from "lucide-react";

interface Batch {
  id: string;
  name: string;
}

interface StudentOption {
  userId: string;
  user: { id: string; name: string | null; universityIdNumber: string; email: string };
}

interface Notice {
  id: string;
  title: string;
  message: string;
  targetType: "ALL" | "DEPARTMENT" | "BATCH" | "STUDENT";
  targetBatch?: { id: string; name: string } | null;
  status: "ACTIVE" | "ARCHIVED";
  publishAt: string | null;
  expiryAt: string | null;
  createdAt: string;
  createdBy: { universityIdNumber: string; email: string; role: string };
}

const TARGET_COLORS: Record<string, string> = {
  ALL: "bg-blue-100 text-blue-700",
  DEPARTMENT: "bg-purple-100 text-purple-700",
  BATCH: "bg-green-100 text-green-700",
  STUDENT: "bg-orange-100 text-orange-700",
};

interface CreateNoticeFormProps {
  batches: Batch[];
  onCreated: () => void;
  onCancel: () => void;
}

function CreateNoticeForm({ batches, onCreated, onCancel }: CreateNoticeFormProps) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetType, setTargetType] = useState<"BATCH" | "STUDENT">("BATCH");
  const [targetBatchId, setTargetBatchId] = useState(batches[0]?.id ?? "");
  const [targetStudentId, setTargetStudentId] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [publishAt, setPublishAt] = useState("");
  const [expiryAt, setExpiryAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (targetType !== "STUDENT" || !studentSearch.trim()) {
      setStudentOptions([]);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/students/search?q=${encodeURIComponent(studentSearch.trim())}&purpose=notice`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Unable to search students.");
        setStudentOptions(payload.students ?? []);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to search students.");
      });
    return () => controller.abort();
  }, [studentSearch, targetType]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetBatchId) {
      setError("Select a batch.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        title,
        message,
        targetType,
      };
      if (targetType === "BATCH") body.targetBatchId = targetBatchId;
      if (targetType === "STUDENT") {
        if (!targetStudentId) throw new Error("Select a student.");
        body.targetStudentId = targetStudentId;
      }
      if (publishAt) body.publishAt = new Date(publishAt).toISOString();
      if (expiryAt) body.expiryAt = new Date(expiryAt).toISOString();

      const res = await fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to create notice.");
      }
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create notice.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="notice-title">Title *</Label>
        <Input
          id="notice-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Notice title"
          minLength={3}
          maxLength={200}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="notice-message">Message *</Label>
        <Textarea
          id="notice-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your notice here..."
          rows={5}
          minLength={10}
          maxLength={5000}
          required
        />
        <p className="text-xs text-muted-foreground">{message.length}/5000</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="notice-target-type">Target</Label>
          <select
            id="notice-target-type"
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as "BATCH" | "STUDENT")}
          >
            <option value="BATCH">Batch</option>
            <option value="STUDENT">Individual Student</option>
          </select>
        </div>
        {targetType === "BATCH" && <div className="space-y-1">
          <Label htmlFor="notice-batch">Batch *</Label>
          <select
            id="notice-batch"
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            value={targetBatchId}
            onChange={(e) => setTargetBatchId(e.target.value)}
            required
          >
            {batches.length === 0 && <option value="">No batches assigned</option>}
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>}
      </div>

      {targetType === "STUDENT" && <div className="space-y-1">
        <Label htmlFor="notice-student-search">Find student by ID or email *</Label>
        <Input id="notice-student-search" value={studentSearch} onChange={(event) => { setStudentSearch(event.target.value); setTargetStudentId(""); }} required />
        <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={targetStudentId} onChange={(event) => setTargetStudentId(event.target.value)} required>
          <option value="">Select a student</option>
          {studentOptions.map((student) => <option key={student.userId} value={student.userId}>{student.user.name ?? student.user.universityIdNumber} · {student.user.universityIdNumber} · {student.user.email}</option>)}
        </select>
      </div>}

      <div className="space-y-1">
        <Label htmlFor="notice-publish">Publish at (optional)</Label>
        <Input id="notice-publish" type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="notice-expiry">Expiry Date (optional)</Label>
        <Input
          id="notice-expiry"
          type="datetime-local"
          value={expiryAt}
          onChange={(e) => setExpiryAt(e.target.value)}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={loading || batches.length === 0} className="flex-1">
          {loading ? "Posting..." : "Post Notice"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function NoticeCard({ notice, onArchive }: { notice: Notice; onArchive: (id: string) => void }) {
  return (
    <div className={`border rounded-lg p-4 ${notice.status === "ARCHIVED" ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TARGET_COLORS[notice.targetType]}`}>
              {notice.targetType === "BATCH" && notice.targetBatch
                ? `Batch · ${notice.targetBatch.name}`
                : notice.targetType}
            </span>
            {notice.status === "ARCHIVED" && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                Archived
              </span>
            )}
            {notice.publishAt && new Date(notice.publishAt) > new Date() && <span className="text-xs rounded-full bg-sky-100 px-2 py-0.5 text-sky-700">Scheduled</span>}
            {notice.expiryAt && new Date(notice.expiryAt) < new Date() && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                Expired
              </span>
            )}
          </div>
          <h3 className="font-semibold text-sm text-foreground">{notice.title}</h3>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notice.message}</p>
        </div>
        {notice.status === "ACTIVE" && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => onArchive(notice.id)}
            title="Archive notice"
          >
            <Archive className="size-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="size-3" />
          {new Date(notice.createdAt).toLocaleDateString()}
        </span>
        {notice.expiryAt && (
          <span className="flex items-center gap-1">
            <Tag className="size-3" />
            Expires {new Date(notice.expiryAt).toLocaleDateString()}
          </span>
        )}
        {notice.publishAt && <span>Publishes {new Date(notice.publishAt).toLocaleString()}</span>}
      </div>
    </div>
  );
}

export function MentorNoticesManagement() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [noticesRes, batchesRes] = await Promise.all([
        fetch(`/api/notices?status=${filter}`),
        fetch("/api/batches"),
      ]);

      if (!noticesRes.ok || !batchesRes.ok) throw new Error("Failed to load data.");

      const [noticesJson, batchesJson] = await Promise.all([noticesRes.json(), batchesRes.json()]);
      setNotices(noticesJson.notices ?? []);
      setBatches(batchesJson.batches ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleArchive = async (noticeId: string) => {
    try {
      const res = await fetch(`/api/notices/${noticeId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to archive notice.");
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to archive notice.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="size-5 text-primary" />
            Notices
          </h2>
          <p className="text-sm text-muted-foreground">Post and manage notices for your batches.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm" className="gap-1">
          <Plus className="size-4" />
          New Notice
        </Button>
      </div>

      <Dialog open={showCreate} onOpenChange={(v) => !v && setShowCreate(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Post a Notice</DialogTitle>
          </DialogHeader>
          <CreateNoticeForm
            batches={batches}
            onCreated={() => { setShowCreate(false); fetchData(); }}
            onCancel={() => setShowCreate(false)}
          />
        </DialogContent>
      </Dialog>

      <div className="flex gap-2">
        {(["ACTIVE", "ARCHIVED"] as const).map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(s)}
          >
            {s === "ACTIVE" ? "Active" : "Archived"}
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
        <p className="text-sm text-muted-foreground">Loading notices...</p>
      ) : notices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-7 text-center">
            <span className="rounded-full bg-slate-100 p-3 text-slate-600"><ChevronRight className="size-5" /></span>
            <p className="text-sm font-medium text-slate-700">No {filter.toLowerCase()} notices yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notices.map((n) => (
            <NoticeCard key={n.id} notice={n} onArchive={handleArchive} />
          ))}
        </div>
      )}
    </div>
  );
}

// Suppress unused
void CardDescription;
void ChevronRight;
