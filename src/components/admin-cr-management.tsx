"use client";
import { ThemedSelect } from "@/components/ui/themed-select";

import { useEffect, useRef, useState, type FormEvent } from "react";

type BatchChoice = { id: string; name: string };
type CRStudent = {
  id: string;
  name: string | null;
  email: string;
  universityIdNumber: string;
  status: string;
  role: "STUDENT" | "MENTOR";
  crStatus: string;
  isCR?: boolean;
  crBatch?: BatchChoice | null;
  batches: BatchChoice[];
};

export function AdminCRManagement() {
  const [pending, setPending] = useState<CRStudent[]>([]);
  const [results, setResults] = useState<CRStudent[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const studentSearchRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const searchRequestId = useRef(0);
  const [selectedBatch, setSelectedBatch] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !studentSearchRef.current?.contains(event.target)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, []);

  async function load(search = "", requestId?: number) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      const response = await fetch(`/api/admin/cr?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load CR management.");
      setPending(data.pendingRequests ?? []);
      if (requestId === undefined || requestId === searchRequestId.current) {
        setResults(data.searchResults ?? []);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load CR management.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestId = ++searchRequestId.current;
    setShowSearchResults(true);
    await load(query, requestId);
  }

  async function update(student: CRStudent, action: "APPROVE" | "REJECT") {
    const batchId = selectedBatch[student.id] ?? student.batches[0]?.id;
    if (action === "APPROVE" && !batchId) {
      setError("Assign this student to a batch before approving them as a CR.");
      return;
    }

    setBusyId(student.id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/cr", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          userId: student.id,
          ...(action === "APPROVE" ? { batchId } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "CR status could not be updated.");
      setMessage(
        action === "APPROVE"
          ? `${student.name ?? student.universityIdNumber} is now an approved CR.`
          : `${student.name ?? student.universityIdNumber}'s CR request was rejected.`
      );
      await load(query);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "CR status could not be updated.");
    } finally {
      setBusyId(null);
    }
  }

  function batchSelector(student: CRStudent) {
    return (
      <ThemedSelect
        aria-label={`CR batch for ${student.name ?? student.universityIdNumber}`}
        value={selectedBatch[student.id] ?? student.batches[0]?.id ?? ""}
        onChange={(event) =>
          setSelectedBatch((current) => ({ ...current, [student.id]: event.target.value }))
        }
        disabled={!student.batches.length}
        className="h-10 min-w-40 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:opacity-50"
      >
        <option value="" disabled>
          No active batch
        </option>
        {student.batches.map((batch) => (
          <option key={batch.id} value={batch.id}>
            {batch.name}
          </option>
        ))}
      </ThemedSelect>
    );
  }

  function studentCard(student: CRStudent, isPending: boolean) {
    const alreadyApproved = student.crStatus === "APPROVED" && student.isCR;
    return (
      <article key={student.id} className="flex flex-col gap-4 rounded-lg border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900">{student.name ?? "Unnamed student"}</h3>
          <p className="text-sm text-slate-600">{student.universityIdNumber} · {student.email}</p>
          <p className="mt-1 text-xs text-slate-500">
            {student.role === "MENTOR" ? "Mentor + student" : "Student"} · Account: {student.status.replaceAll("_", " ").toLowerCase()} · CR status: {student.crStatus.toLowerCase()}
            {alreadyApproved && student.crBatch ? ` · ${student.crBatch.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {batchSelector(student)}
          {!alreadyApproved && (
            <button
              type="button"
              onClick={() => void update(student, "APPROVE")}
              disabled={busyId === student.id || student.status === "REJECTED" || student.status === "SUSPENDED" || !student.batches.length}
              className="min-h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyId === student.id ? "Saving…" : "Approve as CR"}
            </button>
          )}
          {isPending && (
            <button
              type="button"
              onClick={() => void update(student, "REJECT")}
              disabled={busyId === student.id}
              className="min-h-10 rounded-md border border-rose-300 px-4 text-sm font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-50"
            >
              Reject
            </button>
          )}
        </div>
      </article>
    );
  }

  return (
    <div className="space-y-8">
      {error && <p role="alert" className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {message && <p role="status" className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Pending CR applications</h2>
          <p className="text-sm text-slate-600">Approve a student account in one of their current batches, or reject the request.</p>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">Loading applications…</p>
        ) : pending.length ? (
          <div className="space-y-3">{pending.map((student) => studentCard(student, true))}</div>
        ) : (
          <p className="rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">There are no pending CR applications.</p>
        )}
      </section>

      <section className="space-y-3 border-t border-slate-200 pt-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Find an existing student</h2>
          <p className="text-sm text-slate-600">Search by student ID or email to approve a previously imported student without re-registration.</p>
        </div>
        <div
          ref={studentSearchRef}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setShowSearchResults(false);
            }
          }}
        >
          <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
            <input
              value={query}
              onFocus={() => {
                if (query.trim()) setShowSearchResults(true);
              }}
              onChange={(event) => {
                const value = event.target.value;
                setQuery(value);
                searchRequestId.current += 1;
                if (!value.trim()) {
                  setResults([]);
                  setShowSearchResults(false);
                }
              }}
              placeholder="Student ID or email"
              aria-label="Search students by ID or email"
              className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
            />
            <button type="submit" disabled={loading} className="min-h-10 rounded-md bg-slate-800 px-4 text-sm font-semibold text-white disabled:opacity-50">
              Search
            </button>
          </form>
          {showSearchResults && results.length > 0 && (
            <div className="mt-3 space-y-3">{results.map((student) => studentCard(student, false))}</div>
          )}
          {showSearchResults && !loading && query.trim() && results.length === 0 && (
            <p className="mt-3 text-sm text-slate-500">No matching student accounts found.</p>
          )}
        </div>
      </section>
    </div>
  );
}
