"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  batchId: string;
  students: {
    studentId: string;
    universityIdNumber: string;
    email: string;
  }[];
  onSuccess: () => void;
  onClose: () => void;
}

export function PerformanceEntryModal({ batchId, students, onSuccess, onClose }: Props) {
  const [studentId, setStudentId] = useState(students[0]?.studentId || "");
  const [mode, setMode] = useState<"SIMPLE" | "CATEGORY">("SIMPLE");
  const [category, setCategory] = useState("Assignment");
  const [customCategory, setCustomCategory] = useState("");
  const [score, setScore] = useState<number>(85);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = ["Assignment", "Quiz", "Participation", "Mentor Evaluation", "Other"];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId) return;

    setSubmitting(true);
    setError(null);

    const selectedCategory =
      mode === "CATEGORY"
        ? category === "Other"
          ? customCategory.trim() || "General"
          : category
        : "Overall";

    try {
      const res = await fetch("/api/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          batchId,
          mode,
          category: selectedCategory,
          score: Number(score),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record performance.");

      onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to record performance.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
        <h3 className="text-lg font-bold">Record Student Performance</h3>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Select Student</Label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full h-10 px-3 border rounded-md text-sm bg-background"
              required
            >
              {students.map((s) => (
                <option key={s.studentId} value={s.studentId}>
                  {s.universityIdNumber} ({s.email})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label>Evaluation Mode</Label>
            <div className="flex gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "SIMPLE"}
                  onChange={() => setMode("SIMPLE")}
                />
                <span>Simple (Overall Score)</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "CATEGORY"}
                  onChange={() => setMode("CATEGORY")}
                />
                <span>Category Based</span>
              </label>
            </div>
          </div>

          {mode === "CATEGORY" && (
            <div className="space-y-1">
              <Label>Category</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 px-3 border rounded-md text-sm bg-background"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {category === "Other" && (
                <Input
                  className="mt-2"
                  placeholder="Enter custom category name..."
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  required
                />
              )}
            </div>
          )}

          <div className="space-y-1">
            <Label>Score (0 - 100)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save Record"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
