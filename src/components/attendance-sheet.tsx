"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalPortal } from "@/components/ui/modal-portal";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

interface StudentUser {
  id: string;
  universityIdNumber: string;
  email: string;
}

interface StudentProfile {
  userId: string;
  user: StudentUser;
}

interface EditLog {
  id: string;
  previousStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  reason: string;
  changedAt: string;
  changedBy: {
    universityIdNumber: string;
    email: string;
  };
}

interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  finalizedAt?: string | null;
  student: StudentProfile;
  edits?: EditLog[];
}

interface SessionData {
  id: string;
  batchId: string;
  date: string;
  topic?: string | null;
  location?: string | null;
  status: string;
  notes?: string | null;
  batch: {
    id: string;
    name: string;
    department: {
      name: string;
      code: string;
    };
  };
  mentor: {
    universityIdNumber: string;
    email: string;
  };
  attendanceRecords: AttendanceRecord[];
}

interface StudentSessionData {
  id: string;
  batchId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  topic: string | null;
  location: string | null;
  status: string;
  batch: {
    id: string;
    name: string;
  };
}

interface Props {
  sessionId: string;
  userRole: "ADMIN" | "MODERATOR" | "MENTOR" | "STUDENT";
}

export function AttendanceSheet({ sessionId, userRole }: Props) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [studentSession, setStudentSession] = useState<StudentSessionData | null>(null);
  const [studentAttendance, setStudentAttendance] = useState<{ status: AttendanceStatus; finalizedAt: string | null } | null>(null);
  const [batchStudents, setBatchStudents] = useState<StudentProfile[]>([]);
  const [attendanceState, setAttendanceState] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Modal State for Editing Finalized Record
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [newStatus, setNewStatus] = useState<AttendanceStatus>("PRESENT");
  const [reason, setReason] = useState("");
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // State for viewing edit logs
  const [viewingEdits, setViewingEdits] = useState<EditLog[] | null>(null);

  const canEdit = userRole === "ADMIN" || userRole === "MODERATOR" || userRole === "MENTOR";

  useEffect(() => {
    let isMounted = true;
    const fetchSessionDetails = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/sessions/${sessionId}`);
        if (!res.ok) throw new Error("Failed to load session details.");
        const data = await res.json();
        if (isMounted) {
          if (userRole === "STUDENT") {
            setStudentSession(data.session);
            setStudentAttendance(data.attendanceRecord);
          } else {
            setSession(data.session);
            setBatchStudents(data.batchStudents || []);

            const initialMap: Record<string, AttendanceStatus> = {};
            const recordMap = new Map<string, AttendanceStatus>();
            (data.session.attendanceRecords || []).forEach((r: AttendanceRecord) => {
              recordMap.set(r.studentId, r.status);
            });

            (data.batchStudents || []).forEach((s: StudentProfile) => {
              initialMap[s.userId] = recordMap.get(s.userId) || "PRESENT";
            });

            setAttendanceState(initialMap);
          }
          setLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          if (err instanceof Error) {
            setMessage({ text: err.message, type: "error" });
          } else {
            setMessage({ text: "An error occurred.", type: "error" });
          }
          setLoading(false);
        }
      }
    };

    fetchSessionDetails();
    return () => {
      isMounted = false;
    };
  }, [sessionId, userRole]);

  const refreshSession = async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        if (userRole === "STUDENT") {
          setStudentSession(data.session);
          setStudentAttendance(data.attendanceRecord);
        } else {
          setSession(data.session);
          setBatchStudents(data.batchStudents || []);
        }
      }
    } catch (err) {
      console.error("Failed to refresh session", err);
    }
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceState((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleSave = async (finalize: boolean) => {
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        records: Object.entries(attendanceState).map(([studentId, status]) => ({
          studentId,
          status,
        })),
        finalize,
      };

      const res = await fetch(`/api/sessions/${sessionId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save attendance.");

      setMessage({
        text: finalize ? "Attendance finalized successfully!" : "Attendance draft saved successfully!",
        type: "success",
      });

      refreshSession();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setMessage({ text: err.message, type: "error" });
      } else {
        setMessage({ text: "Failed to save.", type: "error" });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    if (!reason.trim()) {
      alert("A reason is mandatory when correcting finalized attendance.");
      return;
    }

    setSubmittingEdit(true);
    try {
      const res = await fetch(`/api/attendance/${editingRecord.id}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus, reason: reason.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update record.");

      setEditingRecord(null);
      setReason("");
      setMessage({ text: "Finalized attendance record corrected successfully!", type: "success" });
      refreshSession();
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      }
    } finally {
      setSubmittingEdit(false);
    }
  };

  if (userRole === "STUDENT") {
    if (loading) return <p className="text-sm text-muted-foreground">Loading session details...</p>;
    if (message?.type === "error") return <p className="text-sm text-red-600" role="alert">{message.text}</p>;
    if (!studentSession) return <p className="text-sm text-red-500">Session not found.</p>;

    return (
      <Card>
        <CardHeader>
          <CardDescription>{studentSession.batch.name}</CardDescription>
          <CardTitle>{studentSession.topic || "Mentoring Session"}</CardTitle>
          <CardDescription>
            {new Date(studentSession.date).toLocaleDateString()}
            {studentSession.startTime && ` · ${new Date(studentSession.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
            {studentSession.endTime && ` – ${new Date(studentSession.endTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
            {studentSession.location && ` · ${studentSession.location}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded border px-2 py-1">Session: {studentSession.status}</span>
          <span className="rounded border px-2 py-1">
            My attendance: {studentAttendance?.status ?? "NOT RECORDED"}
          </span>
        </CardContent>
      </Card>
    );
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading attendance sheet...</p>;
  if (!session) return <p className="text-sm text-red-500">Session not found.</p>;

  const isFinalized = session.attendanceRecords.some((r) => r.finalizedAt != null) || session.status === "COMPLETED";

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
            {session.batch.department.name} • {session.batch.name}
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
            {session.topic || "Mentoring Session"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Date: {new Date(session.date).toLocaleDateString()} {session.location ? `• Location: ${session.location}` : ""}
          </p>
        </div>
        <div className="text-right">
          <span
            className={`inline-block text-xs px-3 py-1 rounded font-semibold ${
              isFinalized ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
            }`}
          >
            {isFinalized ? "FINALIZED" : "DRAFT"}
          </span>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-md text-sm border ${
            message.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700"
              : "bg-red-500/10 border-red-500/20 text-red-600"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Attendance Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Student Attendance</CardTitle>
            <CardDescription>
              {isFinalized
                ? "Attendance is finalized. Correcting a record requires a mandatory reason."
                : "Select status for each student and save draft or finalize."}
            </CardDescription>
          </div>
          {canEdit && !isFinalized && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving}>
                Save Draft
              </Button>
              <Button size="sm" onClick={() => handleSave(true)} disabled={saving}>
                {saving ? "Finalizing..." : "Finalize Attendance"}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="divide-y border rounded-md overflow-hidden">
            {batchStudents.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground italic text-center">
                No active students in this batch.
              </p>
            ) : (
              batchStudents.map((s) => {
                const record = session.attendanceRecords.find((r) => r.studentId === s.userId);
                const currentStatus = record ? record.status : attendanceState[s.userId] || "PRESENT";
                const recordFinalized = record?.finalizedAt != null || isFinalized;
                const editLogs = record?.edits || [];

                return (
                  <div key={s.userId} className="flex items-center justify-between p-3 text-sm hover:bg-muted/30">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{s.user.universityIdNumber}</span>
                        {editLogs.length > 0 && (
                          <button
                            onClick={() => setViewingEdits(editLogs)}
                            className="text-xs bg-amber-500/10 text-amber-700 px-1.5 py-0.5 rounded font-medium hover:underline"
                          >
                            Edited ({editLogs.length})
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{s.user.email}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      {!recordFinalized && canEdit ? (
                        <div className="flex gap-1">
                          {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as AttendanceStatus[]).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => handleStatusChange(s.userId, st)}
                              className={`px-2.5 py-1 text-xs font-semibold rounded border transition-colors ${
                                currentStatus === st
                                  ? st === "PRESENT"
                                    ? "bg-emerald-600 text-white border-emerald-600"
                                    : st === "ABSENT"
                                    ? "bg-red-600 text-white border-red-600"
                                    : st === "LATE"
                                    ? "bg-amber-600 text-white border-amber-600"
                                    : "bg-blue-600 text-white border-blue-600"
                                  : "bg-background text-muted-foreground border-input hover:bg-accent"
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-1 text-xs font-semibold rounded ${
                              currentStatus === "PRESENT"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : currentStatus === "ABSENT"
                                ? "bg-red-500/10 text-red-600"
                                : currentStatus === "LATE"
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-blue-500/10 text-blue-600"
                            }`}
                          >
                            {currentStatus}
                          </span>

                          {recordFinalized && canEdit && record && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => {
                                setEditingRecord(record);
                                setNewStatus(record.status);
                                setReason("");
                              }}
                            >
                              Correct
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Correction Modal for Finalized Record */}
      {editingRecord && (
        <ModalPortal labelledBy="attendance-correction-title">
          <div className="relative z-50 w-full max-w-lg space-y-4 rounded-xl border border-slate-800 bg-slate-900/95 p-6 text-slate-100 shadow-2xl">
            <h3 id="attendance-correction-title" className="text-lg font-bold">Correct Finalized Attendance</h3>
            <p className="text-xs text-muted-foreground">
              Editing attendance for student <span className="font-semibold text-foreground">{editingRecord.student.user.universityIdNumber}</span>. Any change will be permanently logged in the audit history.
            </p>

            <form onSubmit={handleCorrectionSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label>New Status</Label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as AttendanceStatus)}
                  className="w-full h-10 px-3 border rounded-md text-sm bg-background"
                >
                  <option value="PRESENT">PRESENT</option>
                  <option value="ABSENT">ABSENT</option>
                  <option value="LATE">LATE</option>
                  <option value="EXCUSED">EXCUSED</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label>Mandatory Reason for Correction</Label>
                <Input
                  placeholder="e.g. Student provided medical excuse certificate"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingRecord(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingEdit || !reason.trim()}>
                  {submittingEdit ? "Saving..." : "Submit Correction"}
                </Button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {/* Edit History Popup */}
      {viewingEdits && (
        <ModalPortal labelledBy="attendance-history-title">
          <div className="relative z-50 w-full max-w-lg space-y-4 rounded-xl border border-slate-800 bg-slate-900/95 p-6 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 id="attendance-history-title" className="text-lg font-bold">Correction Log History</h3>
              <Button size="sm" variant="ghost" onClick={() => setViewingEdits(null)}>
                ✕
              </Button>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto divide-y">
              {viewingEdits.map((log) => (
                <div key={log.id} className="pt-2 text-xs space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span>
                      {log.previousStatus} → {log.newStatus}
                    </span>
                    <span className="text-muted-foreground">{new Date(log.changedAt).toLocaleString()}</span>
                  </div>
                  <p className="text-muted-foreground">Reason: &quot;{log.reason}&quot;</p>
                  <p className="text-muted-foreground text-[10px]">Changed by: {log.changedBy.universityIdNumber}</p>
                </div>
              ))}
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
