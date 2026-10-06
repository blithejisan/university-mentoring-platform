"use client";
import { ThemedSelect } from "@/components/ui/themed-select";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface DepartmentOption {
  id: string;
  name: string;
}

interface LowAttendanceStudent {
  studentId: string;
  universityIdNumber: string;
  email: string;
  batchName: string;
  attendancePercentage: number;
}

interface OverviewData {
  departmentId: string;
  departmentName: string;
  lowAttendanceThreshold: number;
  totalStudents: number;
  totalBatches: number;
  lowAttendanceStudentsCount: number;
  lowAttendanceStudents: LowAttendanceStudent[];
  filterOptions: {
    batches: { batchId: string; batchName: string }[];
    mentors: { mentorId: string; name: string | null; universityIdNumber: string }[];
  };
}

export function DepartmentAttendanceOverviewCard({ departments = [] }: { departments?: DepartmentOption[] }) {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [batchId, setBatchId] = useState("");
  const [mentorId, setMentorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    let isMounted = true;
    const fetchOverview = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (departmentId) params.set("departmentId", departmentId);
        if (batchId) params.set("batchId", batchId);
        if (mentorId) params.set("mentorId", mentorId);
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        const query = params.size ? `?${params.toString()}` : "";
        const res = await fetch(`/api/reports/departments/attendance${query}`);
        if (!res.ok) throw new Error("Failed to load department attendance overview.");
        const data = await res.json();
        if (isMounted) {
          setOverview(data.overview);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          if (err instanceof Error) {
            setError(err.message);
          } else {
            setError("Failed to load overview.");
          }
          setLoading(false);
        }
      }
    };

    fetchOverview();
    return () => {
      isMounted = false;
    };
  }, [batchId, departmentId, from, mentorId, to]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading department attendance overview...</p>;
  if (error || !overview) return null;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {departments.length > 0 && (
          <div>
            <label htmlFor="attendance-department" className="text-sm font-medium">Department</label>
            <ThemedSelect id="attendance-department" value={departmentId} onChange={(event) => {
              setDepartmentId(event.target.value);
              setBatchId("");
              setMentorId("");
            }} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </ThemedSelect>
          </div>
        )}
        <div>
          <label htmlFor="attendance-dept-batch" className="text-sm font-medium">Batch</label>
          <ThemedSelect id="attendance-dept-batch" value={batchId} onChange={(event) => setBatchId(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">All batches</option>
            {(overview.filterOptions?.batches ?? []).map((batch) => <option key={batch.batchId} value={batch.batchId}>{batch.batchName}</option>)}
          </ThemedSelect>
        </div>
        <div>
          <label htmlFor="attendance-dept-mentor" className="text-sm font-medium">Mentor</label>
          <ThemedSelect id="attendance-dept-mentor" value={mentorId} onChange={(event) => setMentorId(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">All mentors</option>
            {(overview.filterOptions?.mentors ?? []).map((mentor) => <option key={mentor.mentorId} value={mentor.mentorId}>{mentor.name || mentor.universityIdNumber}</option>)}
          </ThemedSelect>
        </div>
        <div>
          <label htmlFor="attendance-dept-from" className="text-sm font-medium">From</label>
          <input id="attendance-dept-from" type="date" max={to || undefined} value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
        </div>
        <div>
          <label htmlFor="attendance-dept-to" className="text-sm font-medium">To</label>
          <input id="attendance-dept-to" type="date" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
        </div>
      </div>

      <Card className={`ai-neon-card ${overview.lowAttendanceStudentsCount > 0 ? "border-red-500/30 bg-red-500/5" : ""}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Department Attendance Overview</CardTitle>
            <CardDescription>
              {overview.departmentName} Department • Threshold: <span className="font-semibold text-foreground">{overview.lowAttendanceThreshold}%</span>
            </CardDescription>
          </div>
          <span
            className={`px-3 py-1 rounded font-bold text-sm ${
              overview.lowAttendanceStudentsCount > 0 ? "bg-red-600 text-white" : "bg-emerald-600 text-white"
            }`}
          >
            {overview.lowAttendanceStudentsCount} At-Risk Student(s)
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {overview.lowAttendanceStudents.length === 0 ? (
          <p className="text-sm text-emerald-600 font-medium italic">
            ✓ All students in the department are above the {overview.lowAttendanceThreshold}% attendance threshold.
          </p>
        ) : (
          <div className="border rounded-md divide-y overflow-hidden max-h-60 overflow-y-auto">
            {overview.lowAttendanceStudents.map((s) => (
              <div key={s.studentId} className="flex items-center justify-between p-3 text-sm hover:bg-muted/30">
                <div>
                  <span className="font-semibold text-foreground">{s.universityIdNumber}</span>
                  <p className="text-xs text-muted-foreground">
                    {s.batchName} • {s.email}
                  </p>
                </div>
                <span className="font-bold text-red-600 px-2 py-1 bg-red-500/10 rounded">
                  {s.attendancePercentage}% Attendance
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      </Card>
    </div>
  );
}
