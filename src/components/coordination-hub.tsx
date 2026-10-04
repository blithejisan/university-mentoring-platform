"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [announcementBatchId, setAnnouncementBatchId] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteMessage, setNoteMessage] = useState("");
  const [noteBatchId, setNoteBatchId] = useState("");
  const [noteStudentId, setNoteStudentId] = useState("");
  const [submittingAnnouncement, setSubmittingAnnouncement] = useState(false);
  const [submittingNote, setSubmittingNote] = useState(false);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [commentsByNote, setCommentsByNote] = useState<Record<string, Comment[]>>({});
  const [commentErrors, setCommentErrors] = useState<Record<string, string>>({});
  const [commentDraft, setCommentDraft] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const selectedBatchStudents = useMemo(
    () => students.filter((student) => student.batchId === noteBatchId),
    [students, noteBatchId]
  );

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
        students: StudentOption[];
      }>(supportResponse, "Unable to load batch support notes.");
      setAnnouncements(announcementPayload.announcements);
      setSupportNotes(supportPayload.supportNotes);
      setBatches(supportPayload.batches);
      setStudents(supportPayload.students);
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
      <header className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-6 shadow-sm">
        <p className="text-sm font-semibold text-emerald-700">{role === "MENTOR" ? "Mentor workspace" : "Moderator workspace"}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Coordination Hub</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
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
                  <select id="coord-note-batch" value={noteBatchId} onChange={(event) => { setNoteBatchId(event.target.value); setNoteStudentId(""); }} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground" required>
                    {batches.length === 0 && <option value="">No batches available</option>}
                    {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="coord-note-student">Student (optional)</Label>
                  <select id="coord-note-student" value={noteStudentId} onChange={(event) => setNoteStudentId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground" disabled={!noteBatchId}>
                    <option value="">Batch-wide note</option>
                    {selectedBatchStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name || "Student"} · {student.universityIdNumber}
                      </option>
                    ))}
                  </select>
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
