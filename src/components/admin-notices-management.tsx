"use client";
import { ThemedSelect } from "@/components/ui/themed-select";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bell, Plus, Archive, Calendar, AlertCircle, Info } from "lucide-react";

type TargetType = "ALL" | "DEPARTMENT" | "BATCH" | "STUDENT";

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Batch {
  id: string;
  name: string;
  departmentId: string;
}

interface StudentOption {
  userId: string;
  user: { id: string; name: string | null; universityIdNumber: string; email: string };
}

interface Notice {
  id: string;
  title: string;
  message: string;
  targetType: TargetType;
  targetBatch?: { id: string; name: string } | null;
  targetDepartment?: { id: string; name: string; code: string } | null;
  status: "ACTIVE" | "ARCHIVED";
  publishAt: string | null;
  expiryAt: string | null;
  createdAt: string;
  createdBy: { universityIdNumber: string; email: string; role: string };
}

/** role: "ADMIN" can target ALL / DEPARTMENT; "MODERATOR" can target DEPARTMENT/BATCH/STUDENT */
interface Props {
  role: "ADMIN" | "MODERATOR";
  /** MODERATOR: department is pre-scoped from their profile */
  scopedDepartmentId?: string;
}

const TARGET_COLORS: Record<TargetType, string> = {
  ALL: "bg-blue-100 text-blue-700",
  DEPARTMENT: "bg-purple-100 text-purple-700",
  BATCH: "bg-green-100 text-green-700",
  STUDENT: "bg-orange-100 text-orange-700",
};

const TARGET_LABELS: Record<TargetType, string> = {
  ALL: "University-wide",
  DEPARTMENT: "Department",
  BATCH: "Batch",
  STUDENT: "Student",
};

function CreateNoticeForm({
  role,
  scopedDepartmentId,
  departments,
  batches,
  onCreated,
  onCancel,
}: {
  role: "ADMIN" | "MODERATOR";
  scopedDepartmentId?: string;
  departments: Department[];
  batches: Batch[];
  onCreated: () => void;
  onCancel: () => void;
}) {
  const allowedTargets: TargetType[] = role === "ADMIN"
    ? ["ALL", "DEPARTMENT", "BATCH", "STUDENT"]
    : ["DEPARTMENT", "BATCH", "STUDENT"];

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetType, setTargetType] = useState<TargetType>(allowedTargets[0]);
  const [targetDepartmentId, setTargetDepartmentId] = useState(scopedDepartmentId ?? departments[0]?.id ?? "");
  const [targetBatchId, setTargetBatchId] = useState("");
  const [targetStudentId, setTargetStudentId] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [studentSearchError, setStudentSearchError] = useState<string | null>(null);
  const [publishAt, setPublishAt] = useState("");
  const [expiryAt, setExpiryAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredBatches = scopedDepartmentId
    ? batches.filter((b) => b.departmentId === scopedDepartmentId)
    : batches.filter((b) => !targetDepartmentId || b.departmentId === targetDepartmentId);

  useEffect(() => {
    const query = studentSearch.trim();
    if (targetType !== "STUDENT" || !query) {
      setStudentOptions([]);
      setSearchingStudents(false);
      setStudentSearchError(null);
      return;
    }
    const controller = new AbortController();
    setStudentOptions([]);
    setSearchingStudents(true);
    setStudentSearchError(null);
    fetch(`/api/students/search?q=${encodeURIComponent(query)}&purpose=notice`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Unable to search students.");
        if (!controller.signal.aborted) setStudentOptions(payload.students ?? []);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setStudentSearchError(cause instanceof Error ? cause.message : "Unable to search students.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearchingStudents(false);
      });
    return () => controller.abort();
  }, [studentSearch, targetType]);

  useEffect(() => {
    setTargetBatchId(filteredBatches[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDepartmentId, targetType]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { title, message, targetType };
      if (targetType === "ALL") {
        // no extra targeting
      } else if (targetType === "DEPARTMENT") {
        body.targetDepartmentId = targetDepartmentId;
      } else if (targetType === "BATCH") {
        body.targetBatchId = targetBatchId;
      } else if (targetType === "STUDENT") {
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
      if (!res.ok) throw new Error(json.error ?? "Failed to create notice.");
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
        <Label htmlFor="admin-notice-title">Title *</Label>
        <Input
          id="admin-notice-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Notice title"
          minLength={3}
          maxLength={200}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="admin-notice-message">Message *</Label>
        <Textarea
          id="admin-notice-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Notice content..."
          rows={5}
          minLength={10}
          maxLength={5000}
          required
        />
        <p className="text-xs text-muted-foreground">{message.length}/5000</p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="admin-notice-target">Audience *</Label>
        <ThemedSelect
          id="admin-notice-target"
          className="w-full border rounded-md px-3 py-2 text-sm bg-background"
          value={targetType}
          onChange={(e) => {
            setTargetType(e.target.value as TargetType);
            setTargetStudentId("");
          }}
        >
          {allowedTargets.map((t) => (
            <option key={t} value={t}>{TARGET_LABELS[t]}</option>
          ))}
        </ThemedSelect>
      </div>

      {targetType === "DEPARTMENT" && !scopedDepartmentId && (
        <div className="space-y-1">
          <Label htmlFor="admin-dept">Department *</Label>
          <ThemedSelect
            id="admin-dept"
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            value={targetDepartmentId}
            onChange={(e) => setTargetDepartmentId(e.target.value)}
            required
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
            ))}
          </ThemedSelect>
        </div>
      )}

      {targetType === "BATCH" && (
        <div className="space-y-1">
          <Label htmlFor="admin-batch">Batch *</Label>
          <ThemedSelect
            id="admin-batch"
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            value={targetBatchId}
            onChange={(e) => setTargetBatchId(e.target.value)}
            required
          >
            {filteredBatches.length === 0 && <option value="">No batches available</option>}
            {filteredBatches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </ThemedSelect>
        </div>
      )}

      {targetType === "STUDENT" && (
        <div className="space-y-1">
          <Label htmlFor="admin-student-search">Find student by ID or email *</Label>
          <Input id="admin-student-search" value={studentSearch} onChange={(event) => { setStudentSearch(event.target.value); setStudentOptions([]); setStudentSearchError(null); setTargetStudentId(""); }} required />
          {searchingStudents && <p className="text-sm text-muted-foreground" role="status">Searching students...</p>}
          {studentSearchError && <p className="text-sm text-destructive" role="alert">{studentSearchError}</p>}
          {!searchingStudents && !studentSearchError && studentSearch.trim() && studentOptions.length === 0 && (
            <p className="text-sm text-muted-foreground" role="status">No matching students found.</p>
          )}
          <ThemedSelect className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={targetStudentId} onChange={(event) => setTargetStudentId(event.target.value)} required>
            <option value="">{searchingStudents ? "Searching students..." : "Select a student"}</option>
            {studentOptions.map((student) => <option key={student.userId} value={student.userId}>{student.user.name ?? student.user.universityIdNumber} · {student.user.universityIdNumber} · {student.user.email}</option>)}
          </ThemedSelect>
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="admin-notice-publish">Publish at (optional)</Label>
        <Input id="admin-notice-publish" type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="admin-notice-expiry">Expiry Date (optional)</Label>
        <Input
          id="admin-notice-expiry"
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
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "Posting..." : "Post Notice"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AdminNoticesManagement({ role, scopedDepartmentId }: Props) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [noticesRes, deptRes, batchRes] = await Promise.all([
        fetch(`/api/notices?status=${filterStatus}`),
        fetch("/api/departments"),
        fetch("/api/batches"),
      ]);
      const [noticesJson, deptJson, batchJson] = await Promise.all([
        noticesRes.json(),
        deptRes.json(),
        batchRes.json(),
      ]);
      setNotices(noticesJson.notices ?? []);
      setDepartments(deptJson.departments ?? []);
      setBatches(batchJson.batches ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleArchive = async (noticeId: string) => {
    try {
      const res = await fetch(`/api/notices/${noticeId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to archive.");
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to archive.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold leading-snug text-slate-900">
            <Bell className="size-5 text-primary" />
            {role === "ADMIN" ? "University Notices" : "Department Notices"}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {role === "ADMIN"
              ? "Create and manage notices for the university."
              : "Create and manage notices for your department."}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm" className="w-full gap-1 sm:w-auto">
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
            role={role}
            scopedDepartmentId={scopedDepartmentId}
            departments={departments}
            batches={batches}
            onCreated={() => { setShowCreate(false); fetchData(); }}
            onCancel={() => setShowCreate(false)}
          />
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {(["ACTIVE", "ARCHIVED"] as const).map((s) => (
          <Button
            key={s}
            variant={filterStatus === s ? "default" : "outline"}
            size="sm"
            className={filterStatus === s
              ? "border border-[#173b61] bg-[#173b61] text-white hover:bg-[#244f78]"
              : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"}
            onClick={() => setFilterStatus(s)}
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
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : notices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-7 text-center">
            <span className="rounded-full bg-slate-100 p-3 text-slate-600">
              <Info className="size-5" />
            </span>
            <p className="text-sm font-medium text-slate-700">No {filterStatus.toLowerCase()} notices.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notices.map((n) => (
            <div key={n.id} className={`rounded-lg border border-slate-200 bg-white p-4 ${n.status === "ARCHIVED" ? "opacity-70" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TARGET_COLORS[n.targetType]}`}>
                      {TARGET_LABELS[n.targetType]}
                      {n.targetType === "BATCH" && n.targetBatch ? ` · ${n.targetBatch.name}` : ""}
                      {n.targetType === "DEPARTMENT" && n.targetDepartment
                        ? ` · ${n.targetDepartment.name}`
                        : ""}
                    </span>
                      {n.publishAt && new Date(n.publishAt) > new Date() && <span className="text-xs rounded-full bg-sky-100 px-2 py-0.5 text-sky-700">Scheduled</span>}
                    <span className="text-xs text-muted-foreground">
                      by {n.createdBy.universityIdNumber} ({n.createdBy.role})
                    </span>
                    {n.expiryAt && new Date(n.expiryAt) < new Date() && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">Expired</span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold leading-snug text-slate-900">{n.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600 line-clamp-2">{n.message}</p>
                </div>
                {n.status === "ACTIVE" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleArchive(n.id)}
                    title="Archive"
                  >
                    <Archive className="size-4" />
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  {new Date(n.createdAt).toLocaleDateString()}
                </span>
                {n.expiryAt && (
                  <span>Expires {new Date(n.expiryAt).toLocaleDateString()}</span>
                )}
                {n.publishAt && <span>Publishes {new Date(n.publishAt).toLocaleString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Suppress unused
void CardHeader;
void CardTitle;
