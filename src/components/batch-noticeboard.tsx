"use client";
import { ThemedSelect } from "@/components/ui/themed-select";

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
  canDelete?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNoticeAttachment(value: unknown): value is NoticeAttachment {
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    typeof value.url !== "string" ||
    typeof value.type !== "string" ||
    typeof value.size !== "number" ||
    !Number.isFinite(value.size) ||
    value.size < 0
  ) {
    return false;
  }

  if (
    (value.url.startsWith("/uploads/notices/") ||
      value.url.startsWith("/uploads/batch-notices/")) &&
    !value.url.startsWith("//") &&
    !value.url.includes("\\")
  ) {
    return true;
  }

  try {
    const protocol = new URL(value.url).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

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
  const [externalUrl, setExternalUrl] = useState("");
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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

  function addExternalLink() {
    setAttachmentError(null);
    if (attachments.length >= 10) {
      setAttachmentError("A notice can have up to 10 attachments or links.");
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(externalUrl);
    } catch {
      setAttachmentError("Enter a valid HTTP or HTTPS attachment URL.");
      return;
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      setAttachmentError("Only HTTP and HTTPS links are supported.");
      return;
    }
    const filename = parsedUrl.pathname.split("/").filter(Boolean).pop();
    setAttachments((current) => [
      ...current,
      {
        name: filename || parsedUrl.hostname,
        url: parsedUrl.toString(),
        type: "text/uri-list",
        size: 0,
      },
    ]);
    setExternalUrl("");
  }

  async function uploadFiles(files: FileList | File[]) {
    setAttachmentError(null);
    const selectedFiles = Array.from(files);
    if (!selectedFiles.length) return;
    if (attachments.length + selectedFiles.length > 10) {
      setAttachmentError("A notice can have up to 10 attachments or links.");
      return;
    }

    setUploading(true);
    try {
      const uploaded: NoticeAttachment[] = [];
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.set("file", file);
        const response = await fetch("/api/batch-notices/upload", {
          method: "POST",
          body: formData,
        });
        const data: unknown = await response.json().catch(() => null);
        if (!isRecord(data)) {
          throw new Error(
            `Upload failed for ${file.name} (HTTP ${response.status}): the server returned an invalid response.`
          );
        }
        if (!response.ok) {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : `Could not upload ${file.name} (HTTP ${response.status}).`
          );
        }
        if (!isNoticeAttachment(data.attachment)) {
          throw new Error(`Upload completed for ${file.name}, but the server returned invalid attachment metadata.`);
        }
        uploaded.push(data.attachment);
      }
      setAttachments((current) => [...current, ...uploaded]);
    } catch (uploadError) {
      setAttachmentError(
        uploadError instanceof Error ? uploadError.message : "Could not upload attachment."
      );
    } finally {
      setUploading(false);
    }
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
          <p className="text-sm font-medium text-cyan-300">{isAdmin ? "Admin oversight" : "Student workspace"}</p>
          <h1 className="mt-1 text-2xl font-semibold">My Batch noticeboard</h1>
          <p className="mt-2 text-sm text-slate-300">
            {isAdmin ? "Inspect notices across university batches and remove inappropriate posts." : "Updates shared with students in your enrolled batch."}
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
          <ThemedSelect
            value={selectedBatchId}
            onChange={(event) => setSelectedBatchId(event.target.value)}
            className="h-11 rounded-md border border-slate-600 bg-slate-800 px-3 text-white"
          >
            {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
            {!batches.length && <option value="">No batches available</option>}
          </ThemedSelect>
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
                  {(isAdmin || notice.canDelete) && (
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
            <section className="space-y-3 rounded-lg border border-slate-700 p-4" aria-labelledby="notice-attachments-heading">
              <div>
                <h3 id="notice-attachments-heading" className="text-sm font-semibold text-slate-100">Attachments</h3>
                <p className="mt-1 text-xs text-slate-400">Upload PDF, DOCX, PNG, or JPG files (up to 10 MB each), or add an external link.</p>
              </div>
              <label
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  void uploadFiles(event.dataTransfer.files);
                }}
                className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-600 bg-slate-800/50 px-4 py-5 text-center transition hover:border-cyan-400 hover:bg-slate-800 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/40"
              >
                <span className="text-sm font-medium text-slate-100">{uploading ? "Uploading file…" : "Drop files here or choose from your device"}</span>
                <span className="text-xs text-slate-400">PDF, DOCX, PNG, JPG · Maximum 10 attachments</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"
                  multiple
                  disabled={uploading || attachments.length >= 10}
                  onChange={(event) => {
                    void uploadFiles(event.currentTarget.files ?? []);
                    event.currentTarget.value = "";
                  }}
                  className="sr-only"
                />
              </label>
              {attachments.length > 0 && (
                <ul className="space-y-2">
                  {attachments.map((attachment, index) => (
                    <li key={`${attachment.url}-${index}`} className="flex min-h-10 items-center justify-between gap-3 rounded-md bg-slate-800 px-3 py-2 text-sm">
                      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-cyan-300 underline">
                        {attachment.name}
                      </a>
                      <span className="shrink-0 text-xs text-slate-400">
                        {attachment.type === "text/uri-list" ? "Link" : `${(attachment.size / (1024 * 1024)).toFixed(1)} MB`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        aria-label={`Remove ${attachment.name}`}
                        className="shrink-0 rounded px-2 py-1 text-slate-300 hover:bg-rose-900/60 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <label htmlFor="notice-external-link" className="sr-only">External link URL</label>
                <input
                  id="notice-external-link"
                  type="url"
                  value={externalUrl}
                  onChange={(event) => setExternalUrl(event.target.value)}
                  placeholder="https://drive.google.com/…"
                  className="h-10 min-w-0 flex-1 rounded-md border border-slate-600 bg-slate-800 px-3 text-sm text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                />
                <button
                  type="button"
                  onClick={addExternalLink}
                  disabled={!externalUrl.trim() || attachments.length >= 10}
                  className="min-h-10 rounded-md border border-slate-500 px-3 text-sm font-medium text-slate-100 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add external link
                </button>
              </div>
              {attachmentError && <p role="alert" className="text-xs text-rose-300">{attachmentError}</p>}
            </section>
            <label className="group flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 p-3 text-sm transition hover:border-cyan-500/70 hover:bg-slate-800/70 focus-within:ring-2 focus-within:ring-cyan-400/50">
              <input type="checkbox" checked={isPinned} onChange={(event) => setIsPinned(event.target.checked)} className="mt-0.5 size-4 accent-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" />
              <span>
                <span className="font-medium text-slate-100">Pin this notice to the top</span>
                <span className="mt-1 block text-xs text-slate-400">Pinned notices appear before other notices in the batch feed.</span>
              </span>
            </label>
            <label className="group flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 p-3 text-sm transition hover:border-cyan-500/70 hover:bg-slate-800/70 focus-within:ring-2 focus-within:ring-cyan-400/50">
              <input type="checkbox" checked={sendEmailNotification} onChange={(event) => setSendEmailNotification(event.target.checked)} className="mt-0.5 size-4 accent-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" />
              <span>
                <span className="font-medium text-slate-100">Send email notification to all active students in this batch</span>
                <span className="mt-1 block text-xs text-slate-400">When checked, this notice will be emailed to every active student currently assigned to this batch.</span>
              </span>
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-700 pt-4">
              <button type="button" onClick={() => setShowComposer(false)} className="min-h-10 rounded-md border border-slate-600 px-4 text-sm">Cancel</button>
              <button type="submit" disabled={saving || uploading} className="min-h-10 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50">
                {saving ? "Publishing…" : "Publish notice"}
              </button>
            </div>
          </form>
        </ModalPortal>
      )}
    </div>
  );
}
