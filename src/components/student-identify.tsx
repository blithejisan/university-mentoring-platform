"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BadgeCheck, Clipboard, Mail, Search, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type StudentProfile = {
  id: string;
  name: string | null;
  universityIdNumber: string;
  email: string;
  phone: string | null;
  isCR: boolean;
  crStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  crBatch: { id: string; name: string } | null;
  batches: Array<{ id: string; name: string }>;
};

function StudentProfileCard({ student }: { student: StudentProfile }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const isApprovedCR = student.isCR && student.crStatus === "APPROVED";

  async function copyEmail() {
    setCopied(false);
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(student.email);
      setCopied(true);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <article className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-5 shadow-[0_12px_30px_rgba(2,8,18,0.2)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">
            {student.name?.trim() || "Unnamed student"}
          </h2>
          <p className="mt-1 text-sm font-medium text-teal-200">
            Student ID: {student.universityIdNumber}
          </p>
        </div>
        {(isApprovedCR || student.crStatus === "PENDING") && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-300/25 bg-teal-400/10 px-3 py-1 text-xs font-medium text-teal-100">
            <BadgeCheck aria-hidden="true" className="size-4" />
            {isApprovedCR ? "Class Representative" : "CR application pending"}
          </span>
        )}
      </div>

      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Email</dt>
          <dd className="mt-1 break-all text-slate-100">{student.email}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Phone</dt>
          <dd className="mt-1 text-slate-100">{student.phone || "Not provided"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Assigned batches
          </dt>
          <dd className="mt-1 flex flex-wrap gap-2">
            {student.batches.length ? (
              student.batches.map((batch) => (
                <span
                  key={batch.id}
                  className="rounded-full border border-slate-600/80 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-200"
                >
                  {batch.name}
                </span>
              ))
            ) : (
              <span className="text-slate-400">No current batch enrollment</span>
            )}
          </dd>
        </div>
        {student.isCR && student.crStatus === "APPROVED" && student.crBatch && (
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              CR batch
            </dt>
            <dd className="mt-1 text-slate-100">{student.crBatch.name}</dd>
          </div>
        )}
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-700/70 pt-4">
        <Button asChild size="sm">
          <a href={`mailto:${student.email}`}>
            <Mail aria-hidden="true" />
            Send email
          </a>
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={copyEmail}>
          <Clipboard aria-hidden="true" />
          {copied ? "Email copied" : "Copy email"}
        </Button>
        {copyError && (
          <span role="status" className="text-xs text-rose-300">
            Unable to copy email.
          </span>
        )}
      </div>
    </article>
  );
}

export function StudentIdentifySearch() {
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setError("Enter at least 2 characters to search.");
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const response = await fetch(
        `/api/student-identify?q=${encodeURIComponent(normalizedQuery)}`
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to search students.");
      setStudents(data.students);
    } catch (caught) {
      setStudents([]);
      setError(caught instanceof Error ? caught.message : "Unable to search students.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={search}
        className="flex flex-col gap-3 rounded-xl border border-slate-700/80 bg-slate-900/65 p-4 sm:flex-row"
      >
        <label className="sr-only" htmlFor="student-identify-query">
          Search by student ID or name
        </label>
        <Input
          id="student-identify-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Enter a student ID or name"
          minLength={2}
          maxLength={100}
          autoComplete="off"
          className="h-11 border-slate-700 bg-slate-950/70"
        />
        <Button type="submit" disabled={loading} className="h-11 shrink-0">
          <Search aria-hidden="true" />
          {loading ? "Searching..." : "Search students"}
        </Button>
      </form>

      {error && (
        <p role="alert" className="rounded-lg border border-rose-400/25 bg-rose-400/10 p-3 text-sm text-rose-200">
          {error}
        </p>
      )}
      {!loading && searched && !error && students.length === 0 && (
        <p className="rounded-lg border border-slate-700/80 bg-slate-900/50 p-5 text-sm text-slate-300">
          No active students matched that search.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {students.map((student) => (
          <StudentProfileCard key={student.id} student={student} />
        ))}
      </div>
      {students.length === 50 && (
        <p className="text-sm text-slate-400">Showing the first 50 matches. Refine your search to see others.</p>
      )}
    </div>
  );
}

type DirectoryStudent = {
  id: string;
  name: string | null;
  universityIdNumber: string;
  batches: string[];
};

export function MentorActiveStudentsDirectory() {
  const [students, setStudents] = useState<DirectoryStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mentor/students")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load active students.");
        if (!cancelled) setStudents(data.students);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Unable to load active students.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function openStudent(studentId: string) {
    setSelectedId(studentId);
    setProfile(null);
    setProfileError(null);
    setProfileLoading(true);
    setDialogOpen(true);
    try {
      const response = await fetch(`/api/student-identify/${encodeURIComponent(studentId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load student profile.");
      setProfile(data.student);
    } catch (caught) {
      setProfileError(caught instanceof Error ? caught.message : "Unable to load student profile.");
    } finally {
      setProfileLoading(false);
    }
  }

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/65">
        <div className="flex items-center gap-3 border-b border-slate-700/70 px-5 py-4">
          <span className="flex size-10 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
            <UsersRound aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold text-slate-50">Active students</h2>
            <p className="text-sm text-slate-400">
              {loading ? "Loading assigned-batch roster..." : `${students.length} students across your assigned batches`}
            </p>
          </div>
        </div>
        {error ? (
          <p role="alert" className="p-5 text-sm text-rose-300">{error}</p>
        ) : loading ? (
          <p className="p-5 text-sm text-slate-300">Loading students...</p>
        ) : students.length === 0 ? (
          <p className="p-5 text-sm text-slate-300">No active students are enrolled in your assigned batches.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-slate-800/60 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Name</th>
                  <th scope="col" className="px-5 py-3 font-medium">Student ID</th>
                  <th scope="col" className="px-5 py-3 font-medium">Batch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {students.map((student) => (
                  <tr key={student.id}>
                    <td colSpan={3} className="p-0">
                      <button
                        type="button"
                        onClick={() => void openStudent(student.id)}
                        className="grid w-full grid-cols-[1.1fr_1fr_1.2fr] items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-teal-300/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-300"
                      >
                        <span className="font-medium text-slate-100">{student.name?.trim() || "Unnamed student"}</span>
                        <span className="text-teal-200">{student.universityIdNumber}</span>
                        <span className="flex flex-wrap gap-1.5">
                          {student.batches.map((batch) => (
                            <span key={batch} className="rounded-full border border-slate-600/80 bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                              {batch}
                            </span>
                          ))}
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Student profile</DialogTitle>
            <DialogDescription>
              {selectedId ? "Complete student contact and enrollment details." : "Select a student."}
            </DialogDescription>
          </DialogHeader>
          {profileLoading && <p className="text-sm text-slate-300">Loading student profile...</p>}
          {profileError && <p role="alert" className="text-sm text-rose-300">{profileError}</p>}
          {profile && <StudentProfileCard student={profile} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
