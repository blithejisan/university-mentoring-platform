"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ModalPortal } from "@/components/ui/modal-portal";
import { CalendarDays, ChevronDown, ChevronUp, UsersRound } from "lucide-react";

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Batch {
  id: string;
  name: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: string;
  department: Department;
  _count?: {
    studentBatches: number;
    mentorBatches: number;
  };
  mentorBatches?: {
    mentor: { user: { name: string | null; universityIdNumber: string } };
  }[];
}

interface Props {
  userRole: "ADMIN" | "MODERATOR" | "MENTOR" | "STUDENT";
  userDepartmentId?: string;
}

export function BatchList({ userRole }: Props) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Form state for creating batch
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  useEffect(() => {
    fetchBatches();
    if (userRole === "ADMIN" || userRole === "MODERATOR") {
      fetchDepartments();
    }
  }, [userRole]);

  async function fetchBatches() {
    try {
      setLoading(true);
      const res = await fetch("/api/batches");
      if (!res.ok) throw new Error("Failed to load batches.");
      const data = await res.json();
      setBatches(data.batches || []);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchDepartments() {
    try {
      const res = await fetch("/api/departments");
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.departments || []);
        if (data.departments?.length > 0) {
          setDepartmentId(data.departments[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch departments", err);
    }
  }

  async function handleCreateBatch(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          ...(userRole === "MENTOR" ? {} : { departmentId }),
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create batch.");

      setShowCreateModal(false);
      setName("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      fetchBatches();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold leading-tight text-foreground">Batch Directory</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {userRole === "MENTOR"
              ? "Manage your assigned mentoring batches."
              : userRole === "STUDENT"
              ? "Browse batches in your registered department."
              : "Browse batches and review assigned mentors and enrollment."}
          </p>
        </div>
        {(userRole === "ADMIN" || userRole === "MODERATOR" || userRole === "MENTOR") && (
          <Button onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto">+ Create New Batch</Button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-600 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading batches...</p>
      ) : batches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <span className="rounded-full bg-slate-100 p-3 text-slate-600"><UsersRound className="size-5" /></span>
            <p className="text-sm font-medium text-slate-700">No batches found in this directory.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {batches.map((batch) => (
            <Card key={batch.id} className="overflow-hidden border-slate-200 bg-white shadow-sm transition-shadow duration-150 hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="mb-1.5 inline-flex rounded-md border border-[#d4e3d7] bg-[#edf5ee] px-2 py-0.5 text-xs font-semibold text-[#245a3b]">
                      {batch.department?.code ?? "Department"}
                    </span>
                    <CardTitle className="text-lg font-semibold leading-snug text-slate-900">{batch.name}</CardTitle>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded font-medium ${
                      batch.status === "ACTIVE"
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border border-slate-200 bg-slate-100 text-slate-700"
                    }`}
                  >
                    {batch.status}
                  </span>
                </div>
                {batch.description && <CardDescription className="line-clamp-2 leading-relaxed text-slate-600">{batch.description}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="flex min-w-0 items-start gap-2 text-slate-600">
                    <UsersRound className="mt-0.5 size-4 shrink-0 text-[#34724f]" />
                    <span className="min-w-0">{batch.mentorBatches?.length
                      ? batch.mentorBatches.map(({ mentor }) => mentor.user.name || mentor.user.universityIdNumber).join(", ")
                      : "No assigned mentor"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="font-medium text-slate-700">Students</span>
                    <span>{batch._count?.studentBatches ?? 0}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <span className="text-xs text-slate-500">{batch.department?.name}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {userRole !== "STUDENT" && (
                      <Link
                        href={`/${userRole.toLowerCase()}/batches/${batch.id}`}
                        className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Manage batch
                      </Link>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-expanded={expandedBatchId === batch.id}
                      onClick={() => setExpandedBatchId(expandedBatchId === batch.id ? null : batch.id)}
                      className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    >
                      {expandedBatchId === batch.id ? "Hide details" : "View details"}
                      {expandedBatchId === batch.id ? <ChevronUp /> : <ChevronDown />}
                    </Button>
                  </div>
                </div>

                {expandedBatchId === batch.id && (
                  <div className="space-y-3 rounded-lg bg-slate-50 p-3 text-sm">
                    {batch.description && <p className="leading-relaxed text-slate-700">{batch.description}</p>}
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-slate-600">
                      <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4 text-slate-500" />
                        {batch.startDate ? new Date(batch.startDate).toLocaleDateString() : "Start date not set"}
                        {batch.endDate ? ` – ${new Date(batch.endDate).toLocaleDateString()}` : ""}
                      </span>
                      <span>{batch._count?.mentorBatches ?? 0} assigned mentor(s)</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Batch Modal */}
      {showCreateModal && (
        <ModalPortal labelledBy="create-batch-title">
          <div className="relative z-50 w-full max-w-lg space-y-4 rounded-xl border border-slate-800 bg-slate-900/95 p-6 text-slate-100 shadow-2xl">
            <h3 id="create-batch-title" className="text-lg font-bold">Create New Batch</h3>
            <form onSubmit={handleCreateBatch} className="space-y-4">
              {departments.length > 0 && (
                <div className="space-y-1">
                  <Label>Department</Label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full h-10 px-3 border rounded-md text-sm bg-background"
                    required
                  >
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <Label>Batch Name</Label>
                <Input
                  placeholder="e.g. ADS Batch 2026-A"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea
                  placeholder="Optional batch description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Start Date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>End Date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Creating..." : "Create Batch"}
                </Button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
