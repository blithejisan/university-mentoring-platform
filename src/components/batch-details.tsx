"use client";
import { ThemedSelect } from "@/components/ui/themed-select";

import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalPortal } from "@/components/ui/modal-portal";
import { SessionList } from "@/components/session-management";
import { BatchAttendanceReportView } from "@/components/batch-attendance-report";
import { PerformanceEntryModal } from "@/components/performance-entry-modal";
import { compareStudentIds } from "@/lib/student-sorting";

interface Student {
  userId: string;
  phone: string | null;
  user: {
    id: string;
    role: "STUDENT" | "MENTOR";
    universityIdNumber: string;
    name: string | null;
    email: string;
  };
}

interface StudentBatchRelation {
  studentId: string;
  joinedAt: string;
  leftAt?: string | null;
  student: Student;
}

interface Mentor {
  userId: string;
  user: {
    id: string;
    universityIdNumber: string;
    email: string;
  };
}

interface MentorBatchRelation {
  mentorId: string;
  mentor: Mentor;
}

interface BatchDetails {
  id: string;
  name: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: string;
  department: {
    id: string;
    name: string;
    code: string;
  };
  studentBatches: StudentBatchRelation[];
  mentorBatches: MentorBatchRelation[];
}

interface SearchStudentResult {
  userId: string;
  user: {
    role: "STUDENT" | "MENTOR";
    universityIdNumber: string;
    email: string;
  };
}

interface ApprovedMentorResult {
  userId: string;
  user: {
    universityIdNumber: string;
    email: string;
  };
}

interface ImportPreviewRow {
  rowNumber: number;
  studentId: string;
  name: string;
  email: string;
  phone: string;
  valid: boolean;
  status: "Valid" | "Needs review";
  errors: string[];
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeImportHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

interface Props {
  batchId: string;
  userRole: "ADMIN" | "MODERATOR" | "MENTOR" | "STUDENT";
}

export function BatchDetailsView({ batchId, userRole }: Props) {
  const [batch, setBatch] = useState<BatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search/Assign Student State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchStudentResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRequestId = useRef(0);
  const [rosterSearch, setRosterSearch] = useState("");
  const [studentIdInput, setStudentIdInput] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [newStudentPhone, setNewStudentPhone] = useState("");
  const [addingStudent, setAddingStudent] = useState(false);
  const [studentMessage, setStudentMessage] = useState<string | null>(null);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [importRows, setImportRows] = useState<ImportPreviewRow[]>([]);
  const [importingPreview, setImportingPreview] = useState(false);
  const [importPreviewError, setImportPreviewError] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const [importingRows, setImportingRows] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    imported: Array<{ studentId: string; name: string; email: string; phone: string }>;
    skipped: Array<{ studentId: string; reason: string }>;
    failed: Array<{ studentId: string; reason: string }>;
  } | null>(null);
  const [importActionError, setImportActionError] = useState<string | null>(null);

  // Assign Mentor State
  const [approvedMentors, setApprovedMentors] = useState<ApprovedMentorResult[]>([]);
  const [selectedMentorId, setSelectedMentorId] = useState("");
  const [assigningMentor, setAssigningMentor] = useState(false);
  const [showPerfModal, setShowPerfModal] = useState(false);
  const [showEditBatchModal, setShowEditBatchModal] = useState(false);
  const [editBatchName, setEditBatchName] = useState("");
  const [editBatchDescription, setEditBatchDescription] = useState("");
  const [editBatchStartDate, setEditBatchStartDate] = useState("");
  const [editBatchEndDate, setEditBatchEndDate] = useState("");
  const [updatingBatch, setUpdatingBatch] = useState(false);

  const canManage = userRole === "ADMIN" || userRole === "MODERATOR";
  const canManageStudents = canManage || userRole === "MENTOR";
  const canEditBatch = canManageStudents;

  const fetchBatchDetails = async () => {
    try {
      const res = await fetch(`/api/batches/${batchId}`);
      if (!res.ok) throw new Error("Failed to load batch details.");
      const data = await res.json();
      setBatch(data.batch);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  function openEditBatch() {
    if (!batch) return;
    setEditBatchName(batch.name);
    setEditBatchDescription(batch.description ?? "");
    setEditBatchStartDate(batch.startDate?.slice(0, 10) ?? "");
    setEditBatchEndDate(batch.endDate?.slice(0, 10) ?? "");
    setShowEditBatchModal(true);
  }

  async function handleUpdateBatch(event: React.FormEvent) {
    event.preventDefault();
    setUpdatingBatch(true);
    setError(null);
    try {
      const response = await fetch(`/api/batches/${batchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editBatchName,
          description: editBatchDescription,
          startDate: editBatchStartDate || null,
          endDate: editBatchEndDate || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to update batch.");
      setBatch(payload.batch);
      setShowEditBatchModal(false);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Failed to update batch.");
    } finally {
      setUpdatingBatch(false);
    }
  }

  function handleExcelPreview(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setImportRows([]);
      setImportPreviewError(null);
      setImportFileName("");
      return;
    }

    const normalizedFileName = file.name.toLowerCase();
    if (!normalizedFileName.endsWith(".xlsx") && !normalizedFileName.endsWith(".xls")) {
      setImportPreviewError("Only .xlsx and .xls files are supported for preview.");
      setImportRows([]);
      setImportFileName("");
      event.target.value = "";
      return;
    }

    setImportFileName(file.name);
    setImportPreviewError(null);
    setImportingPreview(true);
    setImportRows([]);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buffer = reader.result;
        if (!(buffer instanceof ArrayBuffer)) {
          throw new Error("The selected file could not be read.");
        }

        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];

        if (!sheet) {
          throw new Error("The workbook does not contain a sheet with data.");
        }

        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
          raw: false,
          blankrows: false,
        });

        if (rawRows.length === 0) {
          setImportRows([]);
          setImportPreviewError("No rows were found in the selected spreadsheet.");
          return;
        }

        const normalizedHeaders = Object.keys(rawRows[0]).reduce<Record<string, string>>((acc, key) => {
          acc[normalizeImportHeader(String(key))] = String(key);
          return acc;
        }, {});

        const requiredAliases = ["studentid", "studentidnumber", "universityidnumber", "universityid"];
        const hasRequiredHeader = requiredAliases.some((alias) => Object.hasOwn(normalizedHeaders, alias));
        if (!hasRequiredHeader || !Object.hasOwn(normalizedHeaders, "name") || !Object.hasOwn(normalizedHeaders, "email") || !Object.hasOwn(normalizedHeaders, "phone")) {
          setImportRows([]);
          setImportPreviewError("The spreadsheet is missing one or more required columns: Student ID, Name, Email, Phone.");
          return;
        }

        const seenStudentIds = new Map<string, number>();
        const previewRows: ImportPreviewRow[] = rawRows.map((row, index) => {
          const rowData = Object.fromEntries(
            Object.entries(row).map(([key, value]) => [normalizeImportHeader(String(key)), String(value ?? "").trim()])
          );

          const studentId = [
            rowData.studentid,
            rowData.studentidnumber,
            rowData.universityidnumber,
            rowData.universityid,
          ].find((value) => value && value.length > 0) ?? "";

          const name = rowData.name ?? "";
          const email = rowData.email ?? "";
          const phone = rowData.phone ?? "";
          const errors: string[] = [];

          if (!studentId) errors.push("Missing Student ID.");
          if (!name) errors.push("Missing Name.");
          if (!email) errors.push("Missing Email.");
          if (!phone) errors.push("Missing Phone.");
          if (studentId && seenStudentIds.has(studentId)) {
            errors.push("Duplicate Student ID in file.");
          } else if (studentId) {
            seenStudentIds.set(studentId, index + 2);
          }
          if (email && !EMAIL_PATTERN.test(email)) {
            errors.push("Invalid email format.");
          }

          if (studentId && name && email && phone && errors.length === 0) {
            return {
              rowNumber: index + 2,
              studentId,
              name,
              email,
              phone,
              valid: true,
              status: "Valid",
              errors: [],
            };
          }

          return {
            rowNumber: index + 2,
            studentId,
            name,
            email,
            phone,
            valid: false,
            status: "Needs review",
            errors,
          };
        });

        setImportRows(previewRows.sort((a, b) => compareStudentIds(a.studentId, b.studentId)));
      } catch (error: unknown) {
        setImportPreviewError(error instanceof Error ? error.message : "The selected file could not be processed.");
        setImportRows([]);
      } finally {
        setImportingPreview(false);
      }
    };

    reader.onerror = () => {
      setImportPreviewError("The selected file could not be read.");
      setImportRows([]);
      setImportingPreview(false);
    };

    reader.readAsArrayBuffer(file);
  }

  async function handleConfirmImport() {
    const validRows = importRows.filter((row) => row.valid);
    if (validRows.length === 0) {
      setImportActionError("No valid rows are ready to import.");
      return;
    }

    setImportingRows(true);
    setImportActionError(null);

    try {
      const response = await fetch(`/api/batches/${batchId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: validRows.map((row) => ({
            universityIdNumber: row.studentId,
            name: row.name,
            email: row.email,
            phone: row.phone,
          })),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to import selected students.");
      }

      setImportSummary({
        imported: payload.imported ?? [],
        skipped: payload.skipped ?? [],
        failed: payload.failed ?? [],
      });
      setImportRows([]);
      setImportFileName("");
      setImportPreviewError(null);
      const input = document.querySelector<HTMLInputElement>('input[type="file"]');
      if (input) input.value = "";
      await fetchBatchDetails();
    } catch (cause: unknown) {
      setImportActionError(cause instanceof Error ? cause.message : "Failed to import selected students.");
    } finally {
      setImportingRows(false);
    }
  }

  async function handleAddStudent(event: React.FormEvent) {
    event.preventDefault();
    setAddingStudent(true);
    setStudentError(null);
    setStudentMessage(null);
    try {
      const response = await fetch(`/api/batches/${batchId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universityIdNumber: studentIdInput.trim(),
          name: newStudentName.trim() || undefined,
          email: newStudentEmail.trim() || undefined,
          phone: newStudentPhone.trim() || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to add student.");
      setStudentMessage(payload.linkedExistingStudent ? "Existing student linked to this batch." : "Student added to this batch.");
      setStudentIdInput("");
      setNewStudentName("");
      setNewStudentEmail("");
      setNewStudentPhone("");
      await fetchBatchDetails();
    } catch (cause: unknown) {
      setStudentError(cause instanceof Error ? cause.message : "Failed to add student.");
    } finally {
      setAddingStudent(false);
    }
  }

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const res = await fetch(`/api/batches/${batchId}`);
        if (!res.ok) throw new Error("Failed to load batch details.");
        const data = await res.json();
        if (isMounted) {
          setBatch(data.batch);
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
    loadData();
    return () => {
      isMounted = false;
    };
  }, [batchId]);

  useEffect(() => {
    let isMounted = true;
    if (canManage && batch?.department.id) {
      fetch(`/api/mentors/approved?departmentId=${batch.department.id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (isMounted && data?.mentors) {
            setApprovedMentors(data.mentors);
          }
        })
        .catch((err) => console.error("Failed to fetch approved mentors", err));
    }
    return () => {
      isMounted = false;
    };
  }, [canManage, batch?.department.id]);

  function clearStudentSearch() {
    searchRequestId.current += 1;
    setSearchQuery("");
    setSearchResults([]);
    setSearching(false);
  }

  async function handleSearchStudent(e: React.FormEvent) {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      clearStudentSearch();
      return;
    }
    const requestId = ++searchRequestId.current;
    setSearching(true);
    try {
      const res = await fetch(`/api/students/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        if (requestId === searchRequestId.current) {
          setSearchResults(data.students || []);
        }
      }
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      if (requestId === searchRequestId.current) setSearching(false);
    }
  }

  async function handleAssignStudent(studentUserId: string) {
    try {
      const res = await fetch(`/api/batches/${batchId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign student.");
      clearStudentSearch();
      fetchBatchDetails();
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      }
    }
  }

  async function handleRemoveStudent(studentUserId: string) {
    if (!confirm("Are you sure you want to remove this student from the batch?")) return;
    try {
      const res = await fetch(`/api/batches/${batchId}/students?studentUserId=${studentUserId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove student.");
      fetchBatchDetails();
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      }
    }
  }

  async function handleAssignMentor() {
    if (!selectedMentorId) return;
    setAssigningMentor(true);
    try {
      const res = await fetch(`/api/batches/${batchId}/mentors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentorUserId: selectedMentorId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign mentor.");
      setSelectedMentorId("");
      fetchBatchDetails();
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      }
    } finally {
      setAssigningMentor(false);
    }
  }

  async function handleRemoveMentor(mentorUserId: string) {
    if (!confirm("Are you sure you want to remove this mentor from the batch?")) return;
    try {
      const res = await fetch(`/api/batches/${batchId}/mentors?mentorUserId=${mentorUserId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove mentor.");
      fetchBatchDetails();
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      }
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading batch details...</p>;
  if (error || !batch) return <p className="text-sm text-red-500">{error || "Batch not found."}</p>;

  const activeStudents = batch.studentBatches.filter((sb) => !sb.leftAt);
  const archivedStudents = batch.studentBatches.filter((sb) => sb.leftAt);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
            {batch.department.name} ({batch.department.code})
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">{batch.name}</h1>
          {batch.description && <p className="text-sm text-muted-foreground">{batch.description}</p>}
        </div>
        <div className="flex items-center gap-3">
          {canEditBatch && (
            <Button variant="outline" onClick={openEditBatch}>Edit batch</Button>
          )}
          <a
            href={`/${userRole.toLowerCase()}/batches`}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Back to Batches
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mentors Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Assigned Mentors ({batch.mentorBatches.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {canManage && (
              <div className="flex gap-2">
                <ThemedSelect
                  value={selectedMentorId}
                  onChange={(e) => setSelectedMentorId(e.target.value)}
                  className="flex-1 h-9 px-3 border rounded-md text-sm bg-background"
                >
                  <option value="">Select an approved mentor...</option>
                  {approvedMentors
                    .filter((m) => !batch.mentorBatches.some((mb) => mb.mentorId === m.userId))
                    .map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.user.universityIdNumber} ({m.user.email})
                      </option>
                    ))}
                </ThemedSelect>
                <Button size="sm" onClick={handleAssignMentor} disabled={!selectedMentorId || assigningMentor}>
                  Assign
                </Button>
              </div>
            )}

            {batch.mentorBatches.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No mentors assigned to this batch yet.</p>
            ) : (
              <div className="divide-y border rounded-md">
                {batch.mentorBatches.map((mb) => (
                  <div key={mb.mentorId} className="flex items-center justify-between p-3 text-sm">
                    <div>
                      <p className="font-semibold">{mb.mentor.user.universityIdNumber}</p>
                      <p className="text-xs text-muted-foreground">{mb.mentor.user.email}</p>
                    </div>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleRemoveMentor(mb.mentorId)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Student Assignment & List Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Students ({activeStudents.length} Active)</CardTitle>
            {canManageStudents && activeStudents.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setShowPerfModal(true)}>
                + Record Performance
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {canManageStudents && userRole === "MENTOR" && (
              <>
                <form onSubmit={handleAddStudent} className="space-y-3 rounded-md border bg-slate-50 p-3">
                  <h3 className="text-sm font-semibold">Add student by Student ID</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      aria-label="Student ID"
                      placeholder="Student ID"
                      value={studentIdInput}
                      onChange={(event) => setStudentIdInput(event.target.value)}
                      required
                    />
                    <Input
                      aria-label="Student name for a new ID"
                      placeholder="Name for a new student"
                      value={newStudentName}
                      onChange={(event) => setNewStudentName(event.target.value)}
                    />
                    <Input
                      aria-label="Student email for a new ID"
                      type="email"
                      placeholder="Email for a new student"
                      value={newStudentEmail}
                      onChange={(event) => setNewStudentEmail(event.target.value)}
                    />
                    <Input
                      aria-label="Student phone number"
                      type="tel"
                      placeholder="Phone number (optional)"
                      value={newStudentPhone}
                      onChange={(event) => setNewStudentPhone(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">For a new Student ID, provide a name and email.</p>
                    <Button type="submit" size="sm" disabled={addingStudent || !studentIdInput.trim()}>
                      {addingStudent ? "Adding..." : "Add student"}
                    </Button>
                  </div>
                  {studentError && <p className="text-sm text-red-600" role="alert">{studentError}</p>}
                  {studentMessage && <p className="text-sm text-emerald-700" role="status">{studentMessage}</p>}
                </form>

                <div className="space-y-3 rounded-md border border-dashed bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Import students from .xlsx</h3>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Preview only</span>
                  </div>

                  <Input
                    type="file"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={handleExcelPreview}
                  />

                  {importFileName && (
                    <p className="text-xs text-muted-foreground">Selected file: {importFileName}</p>
                  )}

                  {importingPreview && (
                    <p className="text-sm text-muted-foreground">Parsing workbook and validating rows...</p>
                  )}

                  {importPreviewError && (
                    <p className="text-sm text-red-600" role="alert">{importPreviewError}</p>
                  )}

                  {importRows.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                          Preview only until you confirm the import.
                        </p>
                        <Button
                          size="sm"
                          onClick={handleConfirmImport}
                          disabled={importRows.filter((row) => row.valid).length === 0 || importingRows}
                        >
                          {importingRows ? "Importing..." : "Confirm Import"}
                        </Button>
                      </div>

                      {importActionError && (
                        <p className="text-sm text-red-600" role="alert">{importActionError}</p>
                      )}

                      <div className="max-h-72 overflow-auto border rounded-md bg-white">
                        <table className="min-w-full text-left text-xs">
                          <thead className="bg-slate-100 text-slate-700">
                            <tr>
                              <th className="px-2 py-2 font-medium">Row</th>
                              <th className="px-2 py-2 font-medium">Student ID</th>
                              <th className="px-2 py-2 font-medium">Name</th>
                              <th className="px-2 py-2 font-medium">Email</th>
                              <th className="px-2 py-2 font-medium">Phone</th>
                              <th className="px-2 py-2 font-medium">Status</th>
                              <th className="px-2 py-2 font-medium">Errors</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importRows.map((row) => (
                              <tr key={`${row.rowNumber}-${row.studentId || "empty"}`} className="border-t align-top">
                                <td className="px-2 py-2">{row.rowNumber}</td>
                                <td className="px-2 py-2">{row.studentId || "—"}</td>
                                <td className="px-2 py-2">{row.name || "—"}</td>
                                <td className="px-2 py-2">{row.email || "—"}</td>
                                <td className="px-2 py-2">{row.phone || "—"}</td>
                                <td className="px-2 py-2">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 font-medium ${
                                      row.valid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                    }`}
                                  >
                                    {row.status}
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-red-600">
                                  {row.errors.length > 0 ? row.errors.join("; ") : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {importSummary && (
                    <div className="space-y-2 rounded-md border bg-white p-3">
                      <h4 className="text-sm font-semibold">Import result</h4>

                      <div className="grid gap-2 md:grid-cols-3 text-xs">
                        <div className="rounded border bg-emerald-50 p-2">
                          <p className="font-semibold text-emerald-700">Successfully imported</p>
                          <p className="mt-1 text-emerald-800">{importSummary.imported.length}</p>
                        </div>
                        <div className="rounded border bg-amber-50 p-2">
                          <p className="font-semibold text-amber-700">Already existed / skipped</p>
                          <p className="mt-1 text-amber-800">{importSummary.skipped.length}</p>
                        </div>
                        <div className="rounded border bg-red-50 p-2">
                          <p className="font-semibold text-red-700">Failed rows</p>
                          <p className="mt-1 text-red-800">{importSummary.failed.length}</p>
                        </div>
                      </div>

                      {importSummary.imported.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-700">Imported</p>
                          <ul className="mt-1 list-disc pl-4 text-xs text-slate-600">
                            {importSummary.imported.map((row) => (
                              <li key={`${row.studentId}-${row.email}`}>{row.studentId} ({row.email})</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {importSummary.skipped.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-700">Skipped</p>
                          <ul className="mt-1 list-disc pl-4 text-xs text-slate-600">
                            {importSummary.skipped.map((row) => (
                              <li key={`${row.studentId}-${row.reason}`}>{row.studentId}: {row.reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {importSummary.failed.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-700">Failures</p>
                          <ul className="mt-1 list-disc pl-4 text-xs text-red-600">
                            {importSummary.failed.map((row) => (
                              <li key={`${row.studentId}-${row.reason}`}>{row.studentId}: {row.reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {canManage && (
              <div className="space-y-2">
                <form onSubmit={handleSearchStudent} className="flex gap-2">
                  <Input
                    placeholder="Search Student ID or Email..."
                    value={searchQuery}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSearchQuery(value);
                      searchRequestId.current += 1;
                      setSearching(false);
                      if (!value.trim()) {
                        setSearchResults([]);
                      }
                    }}
                    className="h-9"
                  />
                  <Button size="sm" type="submit" disabled={searching}>
                    Search
                  </Button>
                </form>

                {searchResults.length > 0 && (
                  <div className="max-h-40 divide-y divide-border overflow-y-auto rounded-md border border-border bg-card text-sm text-foreground">
                    {searchResults.map((s) => {
                      const isAssigned = batch.studentBatches.some((sb) => sb.studentId === s.userId && !sb.leftAt);
                      return (
                        <div key={s.userId} className="flex items-center justify-between p-2">
                          <div>
                            <span className="font-semibold">{s.user.universityIdNumber}</span>
                            {s.user.role === "MENTOR" && <span className="ml-2 text-xs text-cyan-700">Mentor + student</span>}
                            <span className="text-xs text-muted-foreground ml-2">({s.user.email})</span>
                          </div>
                          {isAssigned ? (
                            <span className="rounded bg-emerald-900/40 px-2 py-0.5 text-xs font-medium text-emerald-300">
                              Assigned
                            </span>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => handleAssignStudent(s.userId)}>
                              + Add
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No active students in this batch.</p>
            ) : (
              <div className="space-y-2">
                <Input
                  aria-label="Search batch students"
                  placeholder="Filter by Student ID, name, or email"
                  value={rosterSearch}
                  onChange={(event) => setRosterSearch(event.target.value)}
                  className="h-9"
                />
                <div className="divide-y border rounded-md max-h-80 overflow-y-auto">
                {activeStudents
                  .filter((sb) => {
                    const query = rosterSearch.trim().toLowerCase();
                    return !query || [sb.student.user.universityIdNumber, sb.student.user.name, sb.student.user.email]
                      .some((value) => value?.toLowerCase().includes(query));
                  })
                  .map((sb) => (
                  <div key={sb.studentId} className="flex items-center justify-between p-3 text-sm">
                    <div>
                      <p className="font-semibold">{sb.student.user.universityIdNumber}</p>
                      {sb.student.user.role === "MENTOR" && <p className="text-xs font-medium text-cyan-700">Mentor + student</p>}
                      {sb.student.user.name && <p className="text-xs text-slate-700">{sb.student.user.name}</p>}
                      <p className="text-xs text-muted-foreground">{sb.student.user.email}</p>
                      {sb.student.phone && <p className="text-xs text-muted-foreground">{sb.student.phone}</p>}
                    </div>
                    {canManageStudents && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleRemoveStudent(sb.studentId)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                {activeStudents.length > 0 && !activeStudents.some((sb) => {
                  const query = rosterSearch.trim().toLowerCase();
                  return !query || [sb.student.user.universityIdNumber, sb.student.user.name, sb.student.user.email]
                    .some((value) => value?.toLowerCase().includes(query));
                }) && <p className="p-3 text-sm text-muted-foreground">No students match this search.</p>}
                </div>
              </div>
            )}

            {archivedStudents.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Past / Removed Students</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {archivedStudents.map((sb) => (
                    <div key={sb.studentId} className="flex justify-between py-1">
                      <span>{sb.student.user.universityIdNumber}</span>
                      <span>Left: {new Date(sb.leftAt!).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="pt-6 border-t">
        <SessionList batchId={batchId} userRole={userRole} />
      </div>

      <div className="pt-6 border-t">
        <BatchAttendanceReportView batchId={batchId} />
      </div>

      {showEditBatchModal && (
        <ModalPortal labelledBy="edit-batch-title">
          <div className="relative z-50 w-full max-w-lg space-y-4 rounded-xl border border-slate-800 bg-slate-900/95 p-6 text-slate-100 shadow-2xl">
            <h2 id="edit-batch-title" className="text-lg font-semibold">Edit batch</h2>
            <form onSubmit={handleUpdateBatch} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="edit-batch-name">Batch name</Label>
                <Input id="edit-batch-name" value={editBatchName} onChange={(event) => setEditBatchName(event.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-batch-description">Description</Label>
                <Input id="edit-batch-description" value={editBatchDescription} onChange={(event) => setEditBatchDescription(event.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="edit-batch-start">Start date</Label>
                  <Input id="edit-batch-start" type="date" value={editBatchStartDate} onChange={(event) => setEditBatchStartDate(event.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-batch-end">End date</Label>
                  <Input id="edit-batch-end" type="date" value={editBatchEndDate} onChange={(event) => setEditBatchEndDate(event.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowEditBatchModal(false)}>Cancel</Button>
                <Button type="submit" disabled={updatingBatch}>{updatingBatch ? "Saving..." : "Save changes"}</Button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {showPerfModal && (
        <PerformanceEntryModal
          batchId={batchId}
          students={activeStudents.map((sb) => ({
            studentId: sb.studentId,
            universityIdNumber: sb.student.user.universityIdNumber,
            email: sb.student.user.email,
          }))}
          onSuccess={() => {
            alert("Performance record saved successfully!");
          }}
          onClose={() => setShowPerfModal(false)}
        />
      )}
    </div>
  );
}
