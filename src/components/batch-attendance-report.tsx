"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface StudentRow {
  studentId: string;
  universityIdNumber: string;
  email: string;
  applicableSessions: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  percentage: number;
  isLowAttendance: boolean;
}

interface ReportData {
  batchId: string;
  batchName: string;
  departmentName: string;
  lowAttendanceThreshold: number;
  totalCompletedSessions: number;
  batchAveragePercentage: number;
  lowAttendanceStudentCount: number;
  students: StudentRow[];
}

interface Props {
  batchId: string;
}

export function BatchAttendanceReportView({ batchId }: Props) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    let isMounted = true;
    const fetchReport = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        const query = params.size ? `?${params.toString()}` : "";
        const res = await fetch(`/api/reports/batches/${batchId}/attendance${query}`);
        if (!res.ok) throw new Error("Failed to load attendance report.");
        const data = await res.json();
        if (isMounted) {
          setReport(data.report);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          if (err instanceof Error) {
            setError(err.message);
          } else {
            setError("Failed to load report.");
          }
          setLoading(false);
        }
      }
    };

    fetchReport();
    return () => {
      isMounted = false;
    };
  }, [batchId, from, to]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading attendance report...</p>;
  if (error || !report) return <p className="text-sm text-red-500">{error || "Report unavailable."}</p>;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="batch-attendance-from" className="text-sm font-medium">From</label>
          <input id="batch-attendance-from" type="date" max={to || undefined} value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
        </div>
        <div>
          <label htmlFor="batch-attendance-to" className="text-sm font-medium">To</label>
          <input id="batch-attendance-to" type="date" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed Sessions</CardDescription>
            <CardTitle className="text-2xl font-bold">{report.totalCompletedSessions}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Batch Average Attendance</CardDescription>
            <CardTitle className="text-2xl font-bold text-primary">
              {report.batchAveragePercentage}%
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className={report.lowAttendanceStudentCount > 0 ? "border-red-500/30 bg-red-500/5" : ""}>
          <CardHeader className="pb-2">
            <CardDescription>Low-Attendance Warning (&lt;{report.lowAttendanceThreshold}%)</CardDescription>
            <CardTitle
              className={`text-2xl font-bold ${
                report.lowAttendanceStudentCount > 0 ? "text-red-600" : "text-emerald-600"
              }`}
            >
              {report.lowAttendanceStudentCount} Student(s)
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Main Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Student Attendance Summary</CardTitle>
          <CardDescription>
            Threshold: <span className="font-semibold text-foreground">{report.lowAttendanceThreshold}%</span>.
            Students below threshold are flagged with a warning.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-xs font-semibold uppercase text-muted-foreground border-b">
                <tr>
                  <th className="p-3">Student ID</th>
                  <th className="p-3">Email</th>
                  <th className="p-3 text-center">Sessions</th>
                  <th className="p-3 text-center text-emerald-600">Present</th>
                  <th className="p-3 text-center text-red-600">Absent</th>
                  <th className="p-3 text-center text-amber-600">Late</th>
                  <th className="p-3 text-center text-blue-600">Excused</th>
                  <th className="p-3 text-right">Attendance %</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.students.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-muted-foreground italic">
                      No students enrolled in this batch.
                    </td>
                  </tr>
                ) : (
                  report.students.map((s) => (
                    <tr
                      key={s.studentId}
                      className={s.isLowAttendance ? "bg-red-500/10 font-medium" : "hover:bg-muted/30"}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span>{s.universityIdNumber}</span>
                          {s.isLowAttendance && (
                            <span className="text-[10px] bg-red-600 text-white font-bold px-1.5 py-0.5 rounded">
                              LOW ATTENDANCE
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">{s.email}</td>
                      <td className="p-3 text-center font-semibold">{s.applicableSessions}</td>
                      <td className="p-3 text-center font-semibold text-emerald-600">{s.present}</td>
                      <td className="p-3 text-center font-semibold text-red-600">{s.absent}</td>
                      <td className="p-3 text-center font-semibold text-amber-600">{s.late}</td>
                      <td className="p-3 text-center font-semibold text-blue-600">{s.excused}</td>
                      <td className="p-3 text-right font-bold">
                        <span
                          className={`px-2 py-1 rounded ${
                            s.isLowAttendance
                              ? "bg-red-600 text-white"
                              : s.percentage >= 80
                              ? "text-emerald-600"
                              : "text-amber-600"
                          }`}
                        >
                          {s.percentage}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
