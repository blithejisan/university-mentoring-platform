"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";

type BatchChoice = { id: string; name: string };
type NoticeAttachment = { name: string; url: string; type: string; size: number };
type BatchNotice = {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  attachments: NoticeAttachment[] | null;
  sendEmailNotification: boolean;
  createdAt: string;
  author: { id: string; name: string | null };
  batch: BatchChoice;
};

function renderInlineMarkdown(text: string) {
  const expressions = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^ )]+\))/g;
  return text.split(expressions).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded bg-slate-100 px-1 py-0.5">{part.slice(1, -1)}</code>;
    }
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^ )]+)\)$/);
    if (link) {
      return (
        <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-800 underline">
          {link[1]}
        </a>
      );
    }
    return part;
  });
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="space-y-1 text-sm leading-6 text-slate-700">
      {content.split(/\r?\n/).map((line, index) => {
        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) {
          const headingClass = "mt-3 font-semibold text-slate-900";
          return heading[1].length === 1
            ? <h2 key={index} className={`text-lg ${headingClass}`}>{renderInlineMarkdown(heading[2])}</h2>
            : <h3 key={index} className={headingClass}>{renderInlineMarkdown(heading[2])}</h3>;
        }
        if (/^\s*[-*]\s+/.test(line)) {
          return <p key={index} className="pl-4 before:mr-2 before:content-['•']">{renderInlineMarkdown(line.replace(/^\s*[-*]\s+/, ""))}</p>;
        }
        return line ? <p key={index}>{renderInlineMarkdown(line)}</p> : <div key={index} className="h-2" />;
      })}
    </div>
  );
}

export function BatchNoticeboard({ isAdmin = false }: { isAdmin?: boolean }) {
  const [batches, setBatches] = useState<BatchChoice[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [notices, setNotices] = useState<BatchNotice[]>([]);
  const [canCreateNotice, setCanCreateNotice] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [sendEmailNotification, setSendEmailNotification] = useState(false);
  const [attachments, setAttachments] = useState<NoticeAttachment[]>([]);
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentType, setAttachmentType] = useState("Link");
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const suffix = selectedBatchId ? `?batchId=${encodeURIComponent(selectedBatchId)}` : "";
        const response = await fetch(`/api/batch-notices${suffix}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load batch notices.");
        if (cancelled) return;
        setBatches(data.batches ?? []);
        setNotices(data.notices ?? []);
        setCanCreateNotice(Boolean(data.canCreateNotice));
        if (isAdmin && !selectedBatchId && data.batches?.length) {
          setSelectedBatchId(data.batches[0].id);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load batch notices.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, selectedBatchId]);

  function addAttachment() {
    setAttachmentError(null);
    if (!attachmentName.trim()) {
      setAttachmentError("Enter a name for the attachment.");
      return;
    }
    try {
      const parsedUrl = new URL(attachmentUrl);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        throw new Error("Only HTTP and HTTPS links are supported.");
      }
    } catch {
      setAttachmentError("Enter a valid HTTP or HTTPS attachment URL.");
      return;
    }
    setAttachments((current) => [
      ...current,
      { name: attachmentName.trim(), url: attachmentUrl, type: attachmentType, size: 0 },
    ]);
    setAttachmentName("");
    setAttachmentUrl("");
  }

  async function createNotice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/batch-notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          isPinned,
          sendEmailNotification,
          attachments,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Notice could not be published.");
      setTitle("");
      setContent("");
      setIsPinned(false);
      setSendEmailNotification(false);
      setAttachments([]);
      setShowComposer(false);
      await reloadNotices();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Notice could not be published.");
    } finally {
      setSaving(false);
    }
  }

  async function reloadNotices() {
    const suffix = selectedBatchId ? `?batchId=${encodeURIComponent(selectedBatchId)}` : "";
    const response = await fetch(`/api/batch-notices${suffix}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not refresh batch notices.");
    setNotices(data.notices ?? []);
  }

  async function deleteNotice(noticeId: string) {
    if (!window.confirm("Delete this batch notice? This cannot be undone.")) return;
    setDeletingId(noticeId);
    setError(null);
    try {
      const response = await fetch(`/api/batch-notices/${noticeId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Notice could not be deleted.");
      setNotices((current) => current.filter(({ id }) => id !== noticeId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Notice could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  const selectedBatch = batches.find(({ id }) => id === selectedBatchId);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-700 bg-slate-900/75 p-6 text-slate-100 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-300">{isAdmin ? "Admin oversight" : "Student portal"}</p>
          <h1 className="mt-1 text-2xl font-semibold">My Batch noticeboard</h1>
          <p className="mt-2 text-sm text-slate-300">
            {isAdmin ? "Inspect notices across university batches and remove inappropriate posts." : "Updates shared with students in your batch."}
          </p>
        </div>
        {canCreateNotice && (
          <button
            type="button"
            onClick={() => setShowComposer(true)}
            className="min-h-11 shrink-0 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
          >
            Create notice
          </button>
        )}
      </header>

      {isAdmin && (
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-200 sm:max-w-sm">
          Select batch
          <select
            value={selectedBatchId}
            onChange={(event) => setSelectedBatchId(event.target.value)}
            className="h-11 rounded-md border border-slate-600 bg-slate-800 px-3 text-white"
          >
            {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
            {!batches.length && <option value="">No batches available</option>}
          </select>
        </label>
      )}

      {error && <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {loading ? (
        <p className="py-8 text-center text-sm text-slate-400">Loading notices…</p>
      ) : !batches.length ? (
        <p className="rounded-lg border border-slate-700 bg-slate-900/75 p-6 text-sm text-slate-300">No active batch is assigned to this account yet.</p>
      ) : !notices.length ? (
        <p className="rounded-lg border border-slate-700 bg-slate-900/75 p-6 text-sm text-slate-300">
          {selectedBatch ? `No notices for ${selectedBatch.name} yet.` : "No notices have been posted to your batches yet."}
        </p>
      ) : (
        <ol className="space-y-4">
          {notices.map((notice) => (
            <li key={notice.id} className={`rounded-xl border bg-white p-5 shadow-sm ${notice.isPinned ? "border-amber-300" : "border-slate-200"}`}>
              <article>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-900">{notice.title}</h2>
                      {notice.isPinned && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">Pinned</span>}
                      {isAdmin && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{notice.batch.name}</span>}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {notice.author.name ?? "Batch CR"} · {new Date(notice.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => void deleteNotice(notice.id)}
                      disabled={deletingId === notice.id}
                      className="min-h-9 rounded-md border border-rose-300 px-3 text-sm font-medium text-rose-800 hover:bg-rose-50 disabled:opacity-50"
                    >
                      {deletingId === notice.id ? "Deleting…" : "Delete"}
                    </button>
                  )}
                </div>
                <div className="mt-4">
                  <MarkdownContent content={notice.content} />
                </div>
                {notice.attachments?.length ? (
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {notice.attachments.map((attachment, index) => (
                      <li key={`${attachment.url}-${index}`}>
                        <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-medium text-cyan-900 hover:bg-cyan-100">
                          {attachment.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            </li>
          ))}
        </ol>
      )}

      {showComposer && (
        <ModalPortal labelledBy="create-batch-notice-title">
          <form onSubmit={createNotice} className="my-auto w-full max-w-2xl space-y-5 rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="create-batch-notice-title" className="text-xl font-semibold text-white">Create batch notice</h2>
                <p className="mt-1 text-sm text-slate-400">Posting to {batches.find(({ id }) => id === selectedBatchId)?.name ?? "your CR batch"}.</p>
              </div>
              <button type="button" onClick={() => setShowComposer(false)} aria-label="Close notice composer" className="rounded px-2 py-1 text-slate-300 hover:bg-slate-800">✕</button>
            </div>
            <label className="block space-y-1.5 text-sm font-medium">
              Title
              <input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={3} maxLength={200} className="h-10 w-full rounded-md border px-3" />
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              Notice content (Markdown supported)
              <textarea value={content} onChange={(event) => setContent(event.target.value)} required maxLength={20000} rows={8} placeholder="Write the announcement. Use **bold**, *italic*, links, and headings." className="w-full rounded-md border p-3 text-sm" />
            </label>
            <div className="space-y-3 rounded-lg border border-slate-700 p-3">
              <p className="text-sm font-semibold">Attachments or links</p>
              {attachments.map((attachment, index) => (
                <div key={`${attachment.url}-${index}`} className="flex items-center justify-between gap-2 text-sm">
                  <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="truncate text-cyan-300 underline">{attachment.name}</a>
                  <button type="button" onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="shrink-0 text-rose-300">Remove</button>
                </div>
              ))}
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={attachmentName} onChange={(event) => setAttachmentName(event.target.value)} placeholder="Attachment name" aria-label="Attachment name" className="h-10 rounded-md border px-3 text-sm" />
                <select value={attachmentType} onChange={(event) => setAttachmentType(event.target.value)} aria-label="Attachment type" className="h-10 rounded-md border px-3 text-sm">
                  <option>Link</option><option>Drive</option><option>PDF</option><option>Image</option>
                </select>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input value={attachmentUrl} onChange={(event) => setAttachmentUrl(event.target.value)} placeholder="https://…" aria-label="Attachment URL" className="h-10 min-w-0 flex-1 rounded-md border px-3 text-sm" />
                <button type="button" onClick={addAttachment} className="min-h-10 rounded-md border border-slate-500 px-3 text-sm font-medium hover:bg-slate-800">Add link</button>
              </div>
              {attachmentError && <p role="alert" className="text-xs text-rose-300">{attachmentError}</p>}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isPinned} onChange={(event) => setIsPinned(event.target.checked)} className="size-4 accent-cyan-400" />
              Pin this notice to the top
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sendEmailNotification} onChange={(event) => setSendEmailNotification(event.target.checked)} className="size-4 accent-cyan-400" />
              Email active students in this batch
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-700 pt-4">
              <button type="button" onClick={() => setShowComposer(false)} className="min-h-10 rounded-md border border-slate-600 px-4 text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="min-h-10 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50">
                {saving ? "Publishing…" : "Publish notice"}
              </button>
            </div>
          </form>
        </ModalPortal>
      )}
    </div>
  );
}
