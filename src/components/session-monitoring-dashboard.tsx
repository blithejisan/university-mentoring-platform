"use client";

import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type DashboardRole = "ADMIN" | "MODERATOR";

type SessionCounts = {
  totalSessions: number;
  scheduledSessions: number;
  upcomingSessions: number;
  completedSessions: number;
  cancelledSessions: number;
};

type AttendanceCounts = {
  totalRecords: number;
  finalizedRecords: number;
  draftRecords: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
};

type RemarkCounts = {
  totalRemarks: number;
  openRemarks: number;
  inReviewRemarks: number;
  resolvedRemarks: number;
};

type Activity = SessionCounts & {
  attendance: AttendanceCounts;
  remarks: RemarkCounts;
};

type MonitoringData = {
  departments: (SessionCounts & {
    id: string;
    name: string;
    attendance: AttendanceCounts;
    remarks: RemarkCounts;
  })[];
  summary: SessionCounts;
  attendance: AttendanceCounts;
  remarks: RemarkCounts;
  batches: (Activity & {
    batchId: string;
    batchName: string;
    departmentId: string;
  })[];
  mentors: (Activity & {
    mentorId: string;
    name: string | null;
    universityIdNumber: string;
  })[];
  filterOptions: {
    batches: { batchId: string; batchName: string }[];
    mentors: { mentorId: string; name: string | null; universityIdNumber: string }[];
  };
};

type ActivityRow = {
  id: string;
  title: string;
  subtitle?: string;
  counts: SessionCounts;
};

function SummaryCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <Card className="rounded-md shadow-none">
      <CardContent className="p-4">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function ActivityTable({ title, description, rows }: { title: string; description: string; rows: ActivityRow[] }) {
  return (
    <Card className="rounded-md shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {rows.length === 0 ? (
          <p className="py-5 text-center text-sm text-muted-foreground">No activity to show.</p>
        ) : (
          <div className="max-h-72 overflow-auto">
            <div className="min-w-[34rem]">
              <div className="grid grid-cols-[minmax(11rem,1fr)_repeat(4,minmax(4rem,0.55fr))] gap-3 border-b px-2 pb-2 text-right text-xs font-medium text-muted-foreground">
                <span className="text-left">Name</span>
                <span>Total</span>
                <span>Upcoming</span>
                <span>Completed</span>
                <span>Cancelled</span>
              </div>
              <div className="divide-y">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[minmax(11rem,1fr)_repeat(4,minmax(4rem,0.55fr))] items-center gap-3 px-2 py-3 text-right text-sm"
                  >
                    <div className="min-w-0 text-left">
                      <p className="truncate font-medium text-slate-900">{row.title}</p>
                      {row.subtitle && <p className="truncate text-xs text-muted-foreground">{row.subtitle}</p>}
                    </div>
                    <span className="tabular-nums">{row.counts.totalSessions}</span>
                    <span className="tabular-nums">{row.counts.upcomingSessions}</span>
                    <span className="tabular-nums">{row.counts.completedSessions}</span>
                    <span className="tabular-nums">{row.counts.cancelledSessions}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricList({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: number }[];
}) {
  return (
    <Card className="rounded-md shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <dl className="divide-y">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <dt className="text-muted-foreground">{item.label}</dt>
              <dd className="font-semibold tabular-nums text-slate-900">{item.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

export function SessionMonitoringDashboard({ role }: { role: DashboardRole }) {
  const [monitoring, setMonitoring] = useState<MonitoringData | null>(null);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [mentorId, setMentorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadMonitoring() {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (role === "ADMIN" && departmentId) params.set("departmentId", departmentId);
      if (batchId) params.set("batchId", batchId);
      if (mentorId) params.set("mentorId", mentorId);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const query = params.size > 0 ? `?${params.toString()}` : "";

      try {
        const response = await fetch(`/api/reports/mentoring-sessions${query}`, {
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Failed to load session monitoring.");

        setMonitoring(payload.monitoring);
        if (role === "ADMIN" && !departmentId) {
          setDepartments(payload.monitoring.departments.map(({ id, name }: { id: string; name: string }) => ({ id, name })));
        }
      } catch (cause: unknown) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Failed to load session monitoring.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadMonitoring();
    return () => controller.abort();
  }, [batchId, departmentId, from, mentorId, retryKey, role, to]);

  const departmentNames = new Map((monitoring?.departments ?? departments).map((department) => [department.id, department.name]));
  const hasSessions = (monitoring?.summary.totalSessions ?? 0) > 0;

  return (
    <section className="space-y-4 border-t border-slate-200 pt-6" aria-labelledby="session-monitoring-title">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-medium text-[#34724f]">Session activity</p>
          <h2 id="session-monitoring-title" className="mt-1 text-xl font-semibold text-slate-900">
            {role === "ADMIN" ? "University Mentoring Overview" : "Department Mentoring Overview"}
          </h2>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {role === "ADMIN" && (
          <div>
            <Label htmlFor="monitoring-department">Department</Label>
            <select
              id="monitoring-department"
              value={departmentId}
              onChange={(event) => {
                setDepartmentId(event.target.value);
                setBatchId("");
                setMentorId("");
              }}
              disabled={loading && departments.length === 0}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <Label htmlFor="monitoring-batch">Batch</Label>
          <select id="monitoring-batch" value={batchId} onChange={(event) => setBatchId(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">All batches</option>
            {(monitoring?.filterOptions.batches ?? []).map((batch) => (
              <option key={batch.batchId} value={batch.batchId}>{batch.batchName}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="monitoring-mentor">Mentor</Label>
          <select id="monitoring-mentor" value={mentorId} onChange={(event) => setMentorId(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">All mentors</option>
            {(monitoring?.filterOptions.mentors ?? []).map((mentor) => (
              <option key={mentor.mentorId} value={mentor.mentorId}>{mentor.name || mentor.universityIdNumber}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="monitoring-from">From</Label>
          <input id="monitoring-from" type="date" max={to || undefined} value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
        </div>
        <div>
          <Label htmlFor="monitoring-to">To</Label>
          <input id="monitoring-to" type="date" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
        </div>
      </div>

      {error ? (
        <Card className="rounded-md border-red-200 shadow-none">
          <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <p role="alert" className="text-sm text-red-700">{error}</p>
            <Button variant="outline" size="sm" onClick={() => setRetryKey((key) => key + 1)}>
              <RotateCw aria-hidden="true" className="size-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : loading || !monitoring ? (
        <p className="py-8 text-center text-sm text-muted-foreground" role="status">Loading session monitoring...</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard label="Total sessions" value={monitoring.summary.totalSessions} detail="All session statuses" />
            <SummaryCard label="Upcoming" value={monitoring.summary.upcomingSessions} detail="Scheduled for a future date" />
            <SummaryCard label="Completed" value={monitoring.summary.completedSessions} detail="Attendance finalized" />
            <SummaryCard label="Cancelled" value={monitoring.summary.cancelledSessions} detail="Cancelled sessions" />
          </div>

          {!hasSessions && (
            <p className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-muted-foreground">
              No mentoring sessions found for this scope.
            </p>
          )}

          {role === "ADMIN" && (
            <ActivityTable
              title="Department activity"
              description="Session totals by department."
              rows={monitoring.departments.map((department) => ({
                id: department.id,
                title: department.name,
                counts: department,
              }))}
            />
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <ActivityTable
              title="Batch activity"
              description="Sessions by batch."
              rows={monitoring.batches.map((batch) => ({
                id: batch.batchId,
                title: batch.batchName,
                subtitle: departmentNames.get(batch.departmentId),
                counts: batch,
              }))}
            />
            <ActivityTable
              title="Mentor activity"
              description="Sessions by assigned mentor."
              rows={monitoring.mentors.map((mentor) => ({
                id: mentor.mentorId,
                title: mentor.name || mentor.universityIdNumber,
                subtitle: mentor.name ? mentor.universityIdNumber : undefined,
                counts: mentor,
              }))}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <MetricList
              title="Attendance summary"
              items={[
                { label: "Attendance records", value: monitoring.attendance.totalRecords },
                { label: "Finalized", value: monitoring.attendance.finalizedRecords },
                { label: "Draft", value: monitoring.attendance.draftRecords },
                { label: "Present", value: monitoring.attendance.present },
                { label: "Absent", value: monitoring.attendance.absent },
                { label: "Late", value: monitoring.attendance.late },
                { label: "Excused", value: monitoring.attendance.excused },
              ]}
            />
            <MetricList
              title="Remarks and objections"
              items={[
                { label: "Total", value: monitoring.remarks.totalRemarks },
                { label: "Open", value: monitoring.remarks.openRemarks },
                { label: "In review", value: monitoring.remarks.inReviewRemarks },
                { label: "Resolved", value: monitoring.remarks.resolvedRemarks },
              ]}
            />
          </div>
        </div>
      )}
    </section>
  );
}
