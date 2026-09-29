"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface BatchSummary {
  batchId: string;
  batchName: string;
  applicableSessions: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  percentage: number;
}

interface SessionHistoryItem {
  sessionId: string;
  date: string;
  topic: string | null;
  batchName: string;
  status: string;
}

interface StudentSummary {
  studentId: string;
  universityIdNumber: string;
  email: string;
  departmentName: string;
  lowAttendanceThreshold: number;
  totalApplicableSessions: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  attendancePercentage: number;
  isLowAttendance: boolean;
  batchSummaries: BatchSummary[];
  availableBatches: { batchId: string; batchName: string }[];
  sessionHistory: SessionHistoryItem[];
}

interface Props {
  studentUserId: string;
}

export function StudentAttendanceView({ studentUserId }: Props) {
  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    let isMounted = true;
    const fetchSummary = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (batchId) params.set("batchId", batchId);
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        const query = params.size ? `?${params.toString()}` : "";
        const res = await fetch(`/api/reports/students/${studentUserId}/attendance${query}`);
        if (!res.ok) throw new Error("Failed to load attendance summary.");
        const data = await res.json();
        if (isMounted) {
          setSummary(data.summary);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          if (err instanceof Error) {
            setError(err.message);
          } else {
            setError("Failed to load summary.");
          }
          setLoading(false);
        }
      }
    };

    fetchSummary();
    return () => {
      isMounted = false;
    };
  }, [batchId, from, studentUserId, to]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading attendance profile...</p>;
  if (error || !summary) return <p className="text-sm text-red-500">{error || "Data unavailable."}</p>;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="student-attendance-batch" className="text-sm font-medium">Batch</label>
          <select id="student-attendance-batch" value={batchId} onChange={(event) => setBatchId(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">All batches</option>
            {summary.availableBatches.map((batch) => (
              <option key={batch.batchId} value={batch.batchId}>{batch.batchName}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="student-attendance-from" className="text-sm font-medium">From</label>
          <input id="student-attendance-from" type="date" max={to || undefined} value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
        </div>
        <div>
          <label htmlFor="student-attendance-to" className="text-sm font-medium">To</label>
          <input id="student-attendance-to" type="date" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
        </div>
      </div>

      {/* Low Attendance Warning Alert Card */}
      {summary.isLowAttendance && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between text-red-700">
          <div>
            <h4 className="font-bold text-base">⚠️ Low Attendance Warning</h4>
            <p className="text-xs">
              Your overall attendance is <span className="font-bold">{summary.attendancePercentage}%</span>, which is below your department threshold of <span className="font-bold">{summary.lowAttendanceThreshold}%</span>.
            </p>
          </div>
        </div>
      )}

      {/* Main Metrics Card Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Overall Attendance</CardDescription>
            <CardTitle
              className={`text-2xl font-bold ${
                summary.isLowAttendance ? "text-red-600" : "text-emerald-600"
              }`}
            >
              {summary.attendancePercentage}%
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Present</CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600">{summary.presentCount}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Absent</CardDescription>
            <CardTitle className="text-2xl font-bold text-red-600">{summary.absentCount}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Late / Excused</CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-600">
              {summary.lateCount} / {summary.excusedCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Session History List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Session Attendance</CardTitle>
          <CardDescription>History of completed mentoring sessions and your attendance status.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y border rounded-md max-h-80 overflow-y-auto">
            {summary.sessionHistory.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground italic">
                No session records found.
              </p>
            ) : (
              summary.sessionHistory.map((sh, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <span className="font-semibold text-foreground">{sh.topic || "Mentoring Session"}</span>
                    <p className="text-xs text-muted-foreground">
                      {sh.batchName} • {new Date(sh.date).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 text-xs font-semibold rounded ${
                      sh.status === "PRESENT"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : sh.status === "ABSENT"
                        ? "bg-red-500/10 text-red-600"
                        : sh.status === "LATE"
                        ? "bg-amber-500/10 text-amber-600"
                        : "bg-blue-500/10 text-blue-600"
                    }`}
                  >
                    {sh.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
