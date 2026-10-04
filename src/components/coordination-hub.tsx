"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, ChevronUp, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type HubRole = "MENTOR" | "MODERATOR";
type Batch = { id: string; name: string };
type Announcement = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  createdBy: { name: string | null; role: HubRole };
  targetBatch: Batch | null;
};
type StudentOption = {
  id: string;
  batchId: string;
  batchName: string;
  name: string | null;
  universityIdNumber: string;
};
type SupportNote = {
  id: string;
  title: string;
  message: string;
  status: "OPEN" | "RESOLVED";
  createdAt: string;
  updatedAt: string;
  batch: Batch;
  student: { user: { name: string | null } } | null;
  createdBy: { name: string | null; role: HubRole };
  _count: { comments: number };
};
type Comment = {
  id: string;
  content: string;
  createdAt: string;
  author: { name: string | null; role: HubRole };
};
type Tab = "announcements" | "support";

async function readResponse<T>(response: Response, fallback: string): Promise<T> {
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : fallback;
    throw new Error(message);
  }
  return payload as T;
}

function displayName(name: string | null, role: HubRole) {
  return name?.trim() || (role === "MENTOR" ? "Mentor" : "Moderator");
}

export function CoordinationHub({ role }: { role: HubRole }) {
  const [tab, setTab] = useState<Tab>("announcements");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [supportNotes, setSupportNotes] = useState<SupportNote[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [announcementBatchId, setAnnouncementBatchId] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteMessage, setNoteMessage] = useState("");
  const [noteBatchId, setNoteBatchId] = useState("");
  const [noteStudentId, setNoteStudentId] = useState("");
  const [batchStudents, setBatchStudents] = useState<StudentOption[]>([]);
  const [loadingBatchStudents, setLoadingBatchStudents] = useState(false);
  const [batchStudentsError, setBatchStudentsError] = useState<string | null>(null);
  const [studentIdSearch, setStudentIdSearch] = useState("");
  const [studentResults, setStudentResults] = useState<StudentOption[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [studentSearchError, setStudentSearchError] = useState<string | null>(null);
  const [submittingAnnouncement, setSubmittingAnnouncement] = useState(false);
  const [submittingNote, setSubmittingNote] = useState(false);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [commentsByNote, setCommentsByNote] = useState<Record<string, Comment[]>>({});
  const [commentErrors, setCommentErrors] = useState<Record<string, string>>({});
  const [commentDraft, setCommentDraft] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const loadHub = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [announcementResponse, supportResponse] = await Promise.all([
        fetch("/api/coordination/announcements"),
        fetch("/api/coordination/support-notes"),
      ]);
      const announcementPayload = await readResponse<{ announcements: Announcement[] }>(
        announcementResponse,
        "Unable to load announcements."
      );
      const supportPayload = await readResponse<{
        supportNotes: SupportNote[];
        batches: Batch[];
      }>(supportResponse, "Unable to load batch support notes.");
      setAnnouncements(announcementPayload.announcements);
      setSupportNotes(supportPayload.supportNotes);
      setBatches(supportPayload.batches);
      setNoteBatchId((current) => current || supportPayload.batches[0]?.id || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load the coordination hub.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHub();
  }, [loadHub]);

  useEffect(() => {
    if (!noteBatchId) {
      setBatchStudents([]);
      setLoadingBatchStudents(false);
      setBatchStudentsError(null);
      return;
    }
    const controller = new AbortController();
    setLoadingBatchStudents(true);
    setBatchStudentsError(null);
    fetch(`/api/coordination/students?batchId=${encodeURIComponent(noteBatchId)}`, {
      signal: controller.signal,
    })
      .then((response) =>
        readResponse<{ students: StudentOption[] }>(
          response,
          "Unable to load students for this batch."
        )
      )
      .then((payload) => setBatchStudents(payload.students))
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setBatchStudents([]);
        setBatchStudentsError(
          cause instanceof Error ? cause.message : "Unable to load students for this batch."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingBatchStudents(false);
      });
    return () => controller.abort();
  }, [noteBatchId]);

  useEffect(() => {
    const query = studentIdSearch.trim();
    if (query.length < 2 || selectedStudent) {
      setStudentResults([]);
      setSearchingStudents(false);
      setStudentSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearchingStudents(true);
      setStudentSearchError(null);
      try {
        const response = await fetch(
          `/api/coordination/students?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        const payload = await readResponse<{ students: StudentOption[] }>(
          response,
          "Unable to search students."
        );
        setStudentResults(payload.students);
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setStudentSearchError(
          cause instanceof Error ? cause.message : "Unable to search students."
        );
        setStudentResults([]);
      } finally {
        if (!controller.signal.aborted) setSearchingStudents(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [studentIdSearch, selectedStudent]);

  async function createAnnouncement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingAnnouncement(true);
    setError(null);
    try {
      const response = await fetch("/api/coordination/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: announcementTitle,
          content: announcementContent,
          targetBatchId: announcementBatchId || null,
        }),
      });
      const payload = await readResponse<{ announcement: Announcement }>(
        response,
        "Unable to publish announcement."
      );
      setAnnouncements((items) => [payload.announcement, ...items]);
      setAnnouncementTitle("");
      setAnnouncementContent("");
      setAnnouncementBatchId("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to publish announcement.");
    } finally {
      setSubmittingAnnouncement(false);
    }
  }

  async function createSupportNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingNote(true);
    setError(null);
    try {
      const response = await fetch("/api/coordination/support-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: noteBatchId,
          studentId: noteStudentId || null,
          title: noteTitle,
          message: noteMessage,
        }),
      });
      const payload = await readResponse<{ supportNote: SupportNote }>(
        response,
        "Unable to create support note."
      );
      setSupportNotes((items) => [payload.supportNote, ...items]);
      setNoteTitle("");
      setNoteMessage("");
      setNoteStudentId("");
      setStudentIdSearch("");
      setSelectedStudent(null);
      setStudentResults([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create support note.");
    } finally {
      setSubmittingNote(false);
    }
  }

  async function loadComments(noteId: string) {
    setCommentErrors((current) => {
      const next = { ...current };
      delete next[noteId];
      return next;
    });
    try {
      const response = await fetch(`/api/coordination/support-notes/${noteId}/comments`);
      const payload = await readResponse<{ comments: Comment[] }>(response, "Unable to load discussion.");
      setCommentsByNote((current) => ({ ...current, [noteId]: payload.comments }));
    } catch (cause) {
      setCommentErrors((current) => ({
        ...current,
        [noteId]: cause instanceof Error ? cause.message : "Unable to load discussion.",
      }));
    }
  }

  async function toggleThread(noteId: string) {
    if (expandedNoteId === noteId) {
      setExpandedNoteId(null);
      setCommentDraft("");
      return;
    }
    setExpandedNoteId(noteId);
    setCommentDraft("");
    if (!commentsByNote[noteId]) await loadComments(noteId);
  }

  async function postComment(event: React.FormEvent<HTMLFormElement>, noteId: string) {
    event.preventDefault();
    setSendingComment(true);
    setError(null);
    try {
      const response = await fetch(`/api/coordination/support-notes/${noteId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentDraft }),
      });
      const payload = await readResponse<{ comment: Comment }>(response, "Unable to post comment.");
      setCommentsByNote((current) => ({
        ...current,
        [noteId]: [...(current[noteId] ?? []), payload.comment],
      }));
      setSupportNotes((items) =>
        items.map((note) =>
          note.id === noteId
            ? { ...note, _count: { comments: note._count.comments + 1 } }
            : note
        )
      );
      setCommentDraft("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to post comment.");
    } finally {
      setSendingComment(false);
    }
  }

  async function updateStatus(note: SupportNote) {
    const status = note.status === "OPEN" ? "RESOLVED" : "OPEN";
    setUpdatingStatusId(note.id);
    setError(null);
    try {
      const response = await fetch(`/api/coordination/support-notes/${note.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await readResponse<{
        supportNote: { status: SupportNote["status"]; updatedAt: string };
      }>(
        response,
        "Unable to update note status."
      );
      setSupportNotes((items) =>
        items.map((item) => item.id === note.id
          ? { ...item, status: payload.supportNote.status, updatedAt: payload.supportNote.updatedAt }
          : item)
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update note status.");
    } finally {
      setUpdatingStatusId(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-slate-100 shadow-sm">
        <span className="inline-flex rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-emerald-300">
          {role === "MENTOR" ? "Mentor workspace" : "Moderator workspace"}
        </span>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">Coordination Hub</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          Share guidance, keep batch teams in sync, and work through student support together.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3" role="tablist" aria-label="Coordination hub sections">
        <Button
          type="button"
          role="tab"
          aria-selected={tab === "announcements"}
          variant={tab === "announcements" ? "default" : "outline"}
          onClick={() => setTab("announcements")}
        >
          Guidelines &amp; Announcements
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={tab === "support"}
          variant={tab === "support" ? "default" : "outline"}
          onClick={() => setTab("support")}
        >
          Batch Support &amp; Notes
        </Button>
      </div>

      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{error}</p>}
      {loading ? (
        <section
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]"
          role="tabpanel"
          aria-label={tab === "announcements" ? "Guidelines and announcements" : "Batch support and notes"}
          aria-busy="true"
        >
          <div className="space-y-4" role="status" aria-label="Loading coordination content">
            <div className="h-36 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
            <div className="h-36 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          </div>
          <div className="hidden h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-100 lg:block" />
        </section>
      ) : tab === "announcements" ? (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]" role="tabpanel">
          {role === "MODERATOR" && (
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Share an announcement</CardTitle>
                <CardDescription>Reach every batch in your department or choose one batch.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={(event) => void createAnnouncement(event)}>
                  <div className="space-y-1.5">
                    <Label htmlFor="coord-announcement-title">Title</Label>
                    <Input id="coord-announcement-title" value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} minLength={3} maxLength={200} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="coord-announcement-batch">Audience</Label>
                    <select id="coord-announcement-batch" value={announcementBatchId} onChange={(event) => setAnnouncementBatchId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground">
                      <option value="">All department batches</option>
                      {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="coord-announcement-content">Guidance or announcement</Label>
                    <Textarea id="coord-announcement-content" value={announcementContent} onChange={(event) => setAnnouncementContent(event.target.value)} rows={5} maxLength={5000} required />
                  </div>
                  <Button type="submit" disabled={submittingAnnouncement || !announcementTitle.trim() || !announcementContent.trim()}>
                    {submittingAnnouncement ? "Publishing..." : "Publish announcement"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
          <div className="space-y-4">
            {announcements.length === 0 ? (
              <Card><CardContent className="py-10 text-center">
                <MessageSquare className="mx-auto size-8 text-emerald-600" aria-hidden="true" />
                <p className="mt-3 font-medium text-slate-800">Nothing new just yet</p>
                <p className="mt-1 text-sm text-slate-500">Department guidance and announcements will show up here.</p>
              </CardContent></Card>
            ) : announcements.map((announcement) => (
              <Card key={announcement.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle>{announcement.title}</CardTitle>
                      <CardDescription className="mt-2">
                        {displayName(announcement.createdBy.name, announcement.createdBy.role)} · {new Date(announcement.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-800">
                      {announcement.targetBatch?.name ?? "All department batches"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{announcement.content}</p></CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1fr)]" role="tabpanel">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Start a batch update</CardTitle>
              <CardDescription>Share context or ask for help. These notes are private to mentors and moderators with batch access.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={(event) => void createSupportNote(event)}>
                <div className="space-y-1.5">
                  <Label htmlFor="coord-note-batch">Batch</Label>
                  <select id="coord-note-batch" value={noteBatchId} onChange={(event) => {
                    setNoteBatchId(event.target.value);
                    setNoteStudentId("");
                    setSelectedStudent(null);
                    setStudentIdSearch("");
                    setStudentResults([]);
                  }} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground" required>
                    {batches.length === 0 && <option value="">No batches available</option>}
                    {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="coord-batch-student">Select Student from Selected Batch (optional)</Label>
                  <select
                    id="coord-batch-student"
                    value={selectedStudent?.batchId === noteBatchId ? selectedStudent.id : ""}
                    onChange={(event) => {
                      const student = batchStudents.find(({ id }) => id === event.target.value);
                      setSelectedStudent(student ?? null);
                      setNoteStudentId(student?.id ?? "");
                      setStudentIdSearch("");
                      setStudentResults([]);
                      setStudentSearchError(null);
                    }}
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground"
                    disabled={!noteBatchId || loadingBatchStudents || batchStudents.length === 0}
                  >
                    <option value="">
                      {loadingBatchStudents
                        ? "Loading batch students..."
                        : batchStudents.length === 0
                          ? "No enrolled students in this batch"
                          : "Batch-wide note (no student)"}
                    </option>
                    {batchStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name || "Student"} - {student.universityIdNumber}
                      </option>
                    ))}
                  </select>
                  {batchStudentsError && (
                    <p className="text-sm text-rose-700" role="alert">{batchStudentsError}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="coord-student-id-search">Direct Student ID Search (optional)</Label>
                  <Input
                    id="coord-student-id-search"
                    value={studentIdSearch}
                    onChange={(event) => {
                      setStudentIdSearch(event.target.value);
                      setNoteStudentId("");
                      setSelectedStudent(null);
                      setStudentResults([]);
                      setStudentSearchError(null);
                    }}
                    placeholder="Enter at least 2 characters of a student ID"
                    autoComplete="off"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={studentResults.length > 0 && !selectedStudent}
                    aria-controls="coord-student-search-results"
                    aria-describedby="coord-student-search-hint"
                    maxLength={100}
                  />
                  <p id="coord-student-search-hint" className="text-xs text-slate-500">
                    Search by student ID across your accessible batches. Selecting a result also selects its batch.
                  </p>
                  {searchingStudents && (
                    <p className="text-sm text-slate-500" role="status">Searching students...</p>
                  )}
                  {studentSearchError && (
                    <p className="text-sm text-rose-700" role="alert">{studentSearchError}</p>
                  )}
                  {!searchingStudents && !studentSearchError && studentIdSearch.trim().length >= 2 &&
                    !selectedStudent && studentResults.length === 0 && (
                      <p className="text-sm text-slate-500" role="status">No enrolled students found in your batches.</p>
                    )}
                  {studentResults.length > 0 && !selectedStudent && (
                    <ul
                      id="coord-student-search-results"
                      role="listbox"
                      aria-label="Matching students"
                      className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm"
                    >
                      {studentResults.map((student, index) => (
                        <li key={`${student.id}-${student.batchId}`} role="presentation">
                          <button
                            type="button"
                            role="option"
                            aria-selected={false}
                            onClick={() => {
                              setSelectedStudent(student);
                              setNoteStudentId(student.id);
                              setNoteBatchId(student.batchId);
                              setStudentIdSearch(student.universityIdNumber);
                              setStudentResults([]);
                            }}
                            className={`w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-emerald-50 focus-visible:bg-emerald-50 focus-visible:outline-none ${index > 0 ? "border-t border-slate-100" : ""}`}
                          >
                            <span className="block font-medium">{student.name || "Student"} · {student.universityIdNumber}</span>
                            <span className="block text-xs text-slate-500">{student.batchName}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {selectedStudent && (
                    <p className="text-xs font-medium text-emerald-700" role="status">
                      Student linked to {selectedStudent.batchName}.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="coord-note-title">Subject</Label>
                  <Input id="coord-note-title" value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} minLength={3} maxLength={200} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="coord-note-message">Update or support needed</Label>
                  <Textarea id="coord-note-message" value={noteMessage} onChange={(event) => setNoteMessage(event.target.value)} rows={5} maxLength={5000} required />
                </div>
                <Button type="submit" disabled={submittingNote || !noteBatchId || !noteTitle.trim() || !noteMessage.trim()}>
                  {submittingNote ? "Posting..." : "Post to batch"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {supportNotes.length === 0 ? (
              <Card><CardContent className="py-10 text-center">
                <MessageSquare className="mx-auto size-8 text-emerald-600" aria-hidden="true" />
                <p className="mt-3 font-medium text-slate-800">A clear board for now</p>
                <p className="mt-1 text-sm text-slate-500">Post a batch update or student support note to start a discussion.</p>
              </CardContent></Card>
            ) : supportNotes.map((note) => {
              const expanded = expandedNoteId === note.id;
              const comments = commentsByNote[note.id];
              return (
                <Card key={note.id}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle>{note.title}</CardTitle>
                        <CardDescription className="mt-2">
                          {note.batch.name}{note.student?.user.name ? ` · ${note.student.user.name}` : ""} · {displayName(note.createdBy.name, note.createdBy.role)} · {new Date(note.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${note.status === "OPEN" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                        {note.status === "OPEN" ? "Open" : "Resolved"}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{note.message}</p>
                    <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                      <Button type="button" variant="outline" size="sm" onClick={() => void toggleThread(note.id)} aria-expanded={expanded}>
                        {expanded ? <ChevronUp /> : <ChevronDown />}
                        {expanded ? "Hide discussion" : `Discussion (${note._count.comments})`}
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => void updateStatus(note)} disabled={updatingStatusId === note.id}>
                        <Check />{updatingStatusId === note.id ? "Updating..." : note.status === "OPEN" ? "Mark resolved" : "Reopen"}
                      </Button>
                    </div>
                    {expanded && (
                      <div className="space-y-4 rounded-lg bg-slate-50 p-4">
                        {commentErrors[note.id] ? (
                          <div className="space-y-2" role="alert">
                            <p className="text-sm text-rose-700">{commentErrors[note.id]}</p>
                            <Button type="button" size="sm" variant="outline" onClick={() => void loadComments(note.id)}>
                              Retry loading discussion
                            </Button>
                          </div>
                        ) : !comments ? <p className="text-sm text-slate-500" role="status">Loading discussion...</p> : comments.length === 0 ? (
                          <p className="text-sm text-slate-500">No replies yet. Add the first note to the thread.</p>
                        ) : (
                          <ol className="space-y-3">
                            {comments.map((comment) => (
                              <li key={comment.id} className="border-l-2 border-emerald-300 pl-3">
                                <p className="whitespace-pre-wrap text-sm leading-5 text-slate-700">{comment.content}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {displayName(comment.author.name, comment.author.role)} · {new Date(comment.createdAt).toLocaleString()}
                                </p>
                              </li>
                            ))}
                          </ol>
                        )}
                        <form className="flex items-end gap-2" onSubmit={(event) => void postComment(event, note.id)}>
                          <div className="min-w-0 flex-1 space-y-1">
                            <Label htmlFor={`coord-comment-${note.id}`}>Reply to this thread</Label>
                            <Textarea id={`coord-comment-${note.id}`} value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} rows={2} maxLength={3000} required />
                          </div>
                          <Button type="submit" size="icon" aria-label="Send reply" disabled={sendingComment || !commentDraft.trim()}>
                            <Send />
                          </Button>
                        </form>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
