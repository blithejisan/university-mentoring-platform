"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type ReportRole = "ADMIN" | "MODERATOR" | "MENTOR";

interface BatchPerformance {
  batchId: string;
  batchName: string;
  departmentId: string;
  departmentName: string;
  studentCount: number;
  recordCount: number;
  overallAverage: number;
  categoryAverages: { category: string; averageScore: number; count: number }[];
  distribution: { band: string; count: number }[];
  students: {
    studentId: string;
    universityIdNumber: string;
    email: string;
    recordCount: number;
    averageScore: number;
  }[];
}

interface BatchPerformanceData {
  batches: BatchPerformance[];
  filterOptions: {
    departments: { id: string; name: string }[];
    batches: { batchId: string; batchName: string }[];
    mentors: { mentorId: string; name: string | null; universityIdNumber: string }[];
  };
}

export function BatchPerformanceReport({ role }: { role: ReportRole }) {
  const [data, setData] = useState<BatchPerformanceData | null>(null);
  const [departmentId, setDepartmentId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [mentorId, setMentorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (departmentId) params.set("departmentId", departmentId);
    if (batchId) params.set("batchId", batchId);
    if (mentorId) params.set("mentorId", mentorId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    async function loadReport() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/performance${params.size ? `?${params.toString()}` : ""}`, {
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Failed to load batch performance report.");
        setData(payload.report);
      } catch (cause: unknown) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Failed to load batch performance report.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadReport();
    return () => controller.abort();
  }, [batchId, departmentId, from, mentorId, role, to]);

  const departments = data?.filterOptions.departments ?? [];
  const batches = data?.filterOptions.batches ?? [];
  const mentors = data?.filterOptions.mentors ?? [];

  return (
    <section className="space-y-4 border-t border-slate-200 pt-6" aria-labelledby="batch-performance-title">
      <div>
        <p className="text-sm font-medium text-[#34724f]">Performance</p>
        <h2 id="batch-performance-title" className="mt-1 text-xl font-semibold text-slate-900">Batch performance</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {role === "ADMIN" && (
          <div>
            <Label htmlFor="performance-department">Department</Label>
            <select id="performance-department" value={departmentId} onChange={(event) => {
              setDepartmentId(event.target.value);
              setBatchId("");
              setMentorId("");
            }} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">All departments</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <Label htmlFor="performance-batch">Batch</Label>
          <select id="performance-batch" value={batchId} onChange={(event) => setBatchId(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">All authorized batches</option>
            {batches.map((batch) => <option key={batch.batchId} value={batch.batchId}>{batch.batchName}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="performance-mentor">Recorded by mentor</Label>
          <select id="performance-mentor" value={mentorId} onChange={(event) => setMentorId(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">All mentors</option>
            {mentors.map((mentor) => <option key={mentor.mentorId} value={mentor.mentorId}>{mentor.name || mentor.universityIdNumber}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="performance-from">From</Label>
          <input id="performance-from" type="date" max={to || undefined} value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
        </div>
        <div>
          <Label htmlFor="performance-to">To</Label>
          <input id="performance-to" type="date" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
      ) : loading || !data ? (
        <p role="status" className="py-8 text-center text-sm text-muted-foreground">Loading batch performance...</p>
      ) : data.batches.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-muted-foreground">No batches are available in this scope.</p>
      ) : (
        <div className="space-y-4">
          {data.batches.map((batch) => {
            const maxDistribution = Math.max(1, ...batch.distribution.map((item) => item.count));
            return (
              <Card key={batch.batchId} className="rounded-md shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div>
                      <CardTitle className="text-base">{batch.batchName}</CardTitle>
                      <CardDescription>{batch.departmentName}</CardDescription>
                    </div>
                    {batch.recordCount > 0 && (
                      <p className="text-sm font-semibold tabular-nums text-slate-900">Average {batch.overallAverage} / 100</p>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">Students evaluated</p>
                      <p className="mt-1 text-xl font-semibold tabular-nums">{batch.studentCount}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">Performance records</p>
                      <p className="mt-1 text-xl font-semibold tabular-nums">{batch.recordCount}</p>
                    </div>
                    <div className="col-span-2 rounded-md border p-3 sm:col-span-1">
                      <p className="text-xs text-muted-foreground">Average score</p>
                      <p className="mt-1 text-xl font-semibold tabular-nums">{batch.recordCount > 0 ? `${batch.overallAverage} / 100` : "No records"}</p>
                    </div>
                  </div>

                  {batch.recordCount === 0 ? (
                    <p className="text-sm text-muted-foreground">No performance records for this batch and filter range.</p>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <h3 className="mb-2 text-sm font-semibold">Category averages</h3>
                        {batch.categoryAverages.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No categorized records.</p>
                        ) : (
                          <dl className="divide-y rounded-md border px-3">
                            {batch.categoryAverages.map((category) => (
                              <div key={category.category} className="flex items-center justify-between gap-3 py-2 text-sm">
                                <dt className="truncate">{category.category} <span className="text-xs text-muted-foreground">({category.count})</span></dt>
                                <dd className="shrink-0 font-semibold tabular-nums">{category.averageScore} / 100</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </div>
                      <div>
                        <h3 className="mb-2 text-sm font-semibold">Score distribution</h3>
                        <div className="space-y-2">
                          {batch.distribution.map((item) => (
                            <div key={item.band} className="grid grid-cols-[4rem_1fr_2rem] items-center gap-2 text-sm">
                              <span className="text-muted-foreground">{item.band}</span>
                              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-emerald-600" style={{ width: `${(item.count / maxDistribution) * 100}%` }} />
                              </div>
                              <span className="text-right tabular-nums">{item.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {batch.students.length > 0 && (
                    <details className="border-t pt-3">
                      <summary className="cursor-pointer text-sm font-medium">Student comparison ({batch.students.length})</summary>
                      <div className="mt-3 overflow-x-auto rounded-md border">
                        <table className="w-full min-w-[36rem] text-left text-sm">
                          <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                            <tr>
                              <th className="p-2">Student ID</th>
                              <th className="p-2">Email</th>
                              <th className="p-2 text-right">Records</th>
                              <th className="p-2 text-right">Average</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {batch.students.map((student) => (
                              <tr key={student.studentId}>
                                <td className="p-2 font-medium">{student.universityIdNumber}</td>
                                <td className="p-2 text-muted-foreground">{student.email}</td>
                                <td className="p-2 text-right tabular-nums">{student.recordCount}</td>
                                <td className="p-2 text-right font-semibold tabular-nums">{student.averageScore} / 100</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}