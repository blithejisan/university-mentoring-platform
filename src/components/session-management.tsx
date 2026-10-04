"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ModalPortal } from "@/components/ui/modal-portal";

interface Session {
  id: string;
  topic?: string | null;
  location?: string | null;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  status: string;
  mentor?: {
    universityIdNumber: string;
    email: string;
  };
  sessionMentors?: {
    mentor: {
      userId: string;
      user: { universityIdNumber: string; email: string };
    };
  }[];
  attendanceRecord?: {
    status: string;
  } | null;
  _count?: {
    attendanceRecords: number;
  };
}

interface SelectableMentor {
  id: string;
  label: string;
}

interface Props {
  batchId: string;
  userRole: "ADMIN" | "MODERATOR" | "MENTOR" | "STUDENT";
}

export function SessionList({ batchId, userRole }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"UPCOMING" | "HISTORY">("UPCOMING");
  const [currentTime, setCurrentTime] = useState<number | null>(null);

  // Modal / Form state for creating session
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [topic, setTopic] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [availableMentors, setAvailableMentors] = useState<SelectableMentor[]>([]);
  const [selectedMentorIds, setSelectedMentorIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const canCreate = userRole === "ADMIN" || userRole === "MODERATOR" || userRole === "MENTOR";

  async function openCreateModal() {
    setError(null);
    if (userRole === "ADMIN" || userRole === "MODERATOR") {
      try {
        const res = await fetch(`/api/batches/${batchId}`);
        if (!res.ok) throw new Error("Failed to load assigned mentors.");
        const data = await res.json();
        const mentors: SelectableMentor[] = (data.batch?.mentorBatches ?? [])
          .filter((assignment: {
            mentor: {
              approvalStatus: string;
              user: { status: string };
            };
          }) =>
            assignment.mentor.approvalStatus === "APPROVED" &&
            assignment.mentor.user.status === "ACTIVE"
          )
          .map((assignment: {
            mentor: {
              userId: string;
              user: { universityIdNumber: string };
            };
          }) => ({
            id: assignment.mentor.userId,
            label: assignment.mentor.user.universityIdNumber,
          }));
        setAvailableMentors(mentors);
        setSelectedMentorIds(mentors[0] ? [mentors[0].id] : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load assigned mentors.");
        return;
      }
    }
    setShowCreateModal(true);
  }

  useEffect(() => {
    let isMounted = true;
    const loadSessions = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/sessions?batchId=${batchId}`);
        if (!res.ok) throw new Error("Failed to load sessions.");
        const data = await res.json();
        if (isMounted) {
          setSessions(data.sessions || []);
          setCurrentTime(Date.now());
          setLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          if (err instanceof Error) {
            setError(err.message);
          } else {
            setError("An unexpected error occurred.");
          }
          setLoading(false);
        }
      }
    };
    loadSessions();
    return () => {
      isMounted = false;
    };
  }, [batchId]);

  async function fetchSessions() {
    try {
      const res = await fetch(`/api/sessions?batchId=${batchId}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        setCurrentTime(Date.now());
      }
    } catch (err) {
      console.error("Failed to refresh sessions", err);
    }
  }

  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId,
          ...(userRole !== "MENTOR" ? { mentorIds: selectedMentorIds } : {}),
          date,
          topic: topic || undefined,
          location: location || undefined,
          startTime: startTime ? `${date}T${startTime}:00` : undefined,
          endTime: endTime ? `${date}T${endTime}:00` : undefined,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create session.");

      setShowCreateModal(false);
      setTopic("");
      setLocation("");
      setNotes("");
      fetchSessions();
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

  const now = currentTime ?? 0;
  const visibleSessions = sessions
    .filter((session) => {
      const startsAt = new Date(session.startTime ?? session.date).getTime();
      return view === "UPCOMING"
        ? session.status === "SCHEDULED" && startsAt >= now
        : session.status !== "SCHEDULED" || startsAt < now;
    })
    .sort((left, right) => {
      const difference = new Date(left.startTime ?? left.date).getTime() - new Date(right.startTime ?? right.date).getTime();
      return view === "UPCOMING" ? difference : -difference;
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Mentoring Sessions</h2>
          <p className="text-sm text-muted-foreground">
            View scheduled sessions, record attendance, and finalize session logs.
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreateModal}>+ Schedule New Session</Button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-600 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading sessions...</p>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-7 text-center text-sm font-medium text-slate-700">
            No mentoring sessions scheduled for this batch yet.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex gap-2 border-b border-slate-200 pb-3">
            {(["UPCOMING", "HISTORY"] as const).map((nextView) => (
              <Button key={nextView} type="button" size="sm" variant={view === nextView ? "default" : "outline"} onClick={() => setView(nextView)}>
                {nextView === "UPCOMING" ? "Upcoming" : "History"}
              </Button>
            ))}
          </div>
          {visibleSessions.length === 0 ? (
            <Card><CardContent className="py-7 text-center text-sm text-slate-600">{view === "UPCOMING" ? "No upcoming mentoring sessions." : "No session history yet."}</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {visibleSessions.map((s) => (
                <Card key={s.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-primary/10 text-primary rounded mb-1">
                          {new Date(s.date).toLocaleDateString()}
                        </span>
                        <CardTitle className="text-lg">{s.topic || "Mentoring Session"}</CardTitle>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded font-medium ${
                          s.status === "COMPLETED"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : s.status === "SCHEDULED"
                            ? "bg-amber-500/10 text-amber-600"
                            : "bg-gray-500/10 text-gray-600"
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                    {s.location && (
                      <CardDescription>Location: {s.location}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                      {userRole === "STUDENT" ? (
                        <div>
                          My Attendance: <span className="font-semibold text-foreground">{s.attendanceRecord?.status ?? "Not recorded"}</span>
                        </div>
                      ) : (
                        <>
                          <div>
                            Mentors: <span className="font-semibold text-foreground">
                              {s.sessionMentors?.length
                                ? s.sessionMentors
                                    .map((assignment) => assignment.mentor.user.universityIdNumber)
                                    .join(", ")
                                : s.mentor?.universityIdNumber}
                            </span>
                          </div>
                          <div>
                            Attendance Records: <span className="font-semibold text-foreground">{s._count?.attendanceRecords ?? 0}</span>
                          </div>
                        </>
                      )}
                    </div>
                    <a
                      href={`/${userRole.toLowerCase()}/sessions/${s.id}`}
                      className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                    >
                      {s.status === "COMPLETED" ? "View Attendance Sheet →" : "Mark Attendance →"}
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Session Modal */}
      {showCreateModal && (
        <ModalPortal labelledBy="create-session-title">
          <div className="relative z-50 w-full max-w-lg space-y-4 rounded-xl border border-slate-800 bg-slate-900/95 p-6 text-slate-100 shadow-2xl">
            <h3 id="create-session-title" className="text-lg font-bold">Schedule Mentoring Session</h3>
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div className="space-y-1">
                <Label>Topic</Label>
                <Input
                  placeholder="e.g. Academic Progress & Career Guidance"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  required
                />
              </div>

              {(userRole === "ADMIN" || userRole === "MODERATOR") && (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Assigned mentors</legend>
                  {availableMentors.length === 0 ? (
                    <p className="text-sm text-red-400">
                      No active, approved mentors are assigned to this batch.
                    </p>
                  ) : (
                    <div className="max-h-32 space-y-2 overflow-y-auto rounded-md border border-slate-700 p-3">
                      {availableMentors.map((mentor) => (
                        <label key={mentor.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedMentorIds.includes(mentor.id)}
                            onChange={(event) => {
                              setSelectedMentorIds((current) =>
                                event.target.checked
                                  ? [...current, mentor.id]
                                  : current.filter((id) => id !== mentor.id)
                              );
                            }}
                          />
                          {mentor.label}
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>
              )}

              <div className="space-y-1">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Start Time</Label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>End Time</Label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Location / Room</Label>
                <Input
                  placeholder="e.g. Room 402 / Online Meet"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Optional session notes or agenda"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    submitting ||
                    ((userRole === "ADMIN" || userRole === "MODERATOR") &&
                      selectedMentorIds.length === 0)
                  }
                >
                  {submitting ? "Scheduling..." : "Schedule Session"}
                </Button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
