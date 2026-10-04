"use client";

import React, { useState } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface Props {
  sessionId: string;
  sessionTopic: string | null;
  sessionDate: string;
  batchName: string;
  mentors: { id: string; label: string }[];
  onSuccess: () => void;
  onCancel: () => void;
}

const RATING_LABELS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

function StarRating({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div
        id={id}
        className="flex items-center gap-1"
        role="group"
        aria-label={label}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            aria-label={`${star} star`}
            className={`text-2xl transition-transform duration-100 hover:scale-110 focus:outline-none ${
              star <= (hover || value)
                ? "text-amber-400 drop-shadow-sm"
                : "text-muted-foreground/30"
            }`}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
          >
            ★
          </button>
        ))}
        {(hover || value) > 0 && (
          <span className="ml-2 text-xs text-muted-foreground">
            {RATING_LABELS[hover || value]}
          </span>
        )}
      </div>
    </div>
  );
}

export function EvaluateMentorModal({
  sessionId,
  sessionTopic,
  sessionDate,
  batchName,
  mentors,
  onSuccess,
  onCancel,
}: Props) {
  const [overallRating, setOverallRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [helpfulnessRating, setHelpfulnessRating] = useState(0);
  const [sessionQualityRating, setSessionQualityRating] = useState(0);
  const [supportRating, setSupportRating] = useState(0);
  const [mentorId, setMentorId] = useState(mentors[0]?.id ?? "");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (overallRating === 0) {
      setError("Please provide an overall rating before submitting.");
      return;
    }
    if (!mentors.some((mentor) => mentor.id === mentorId)) {
      setError("Please select a mentor assigned to this session.");
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { mentorId, overallRating };
      if (communicationRating > 0) body.communicationRating = communicationRating;
      if (helpfulnessRating > 0) body.helpfulnessRating = helpfulnessRating;
      if (sessionQualityRating > 0) body.sessionQualityRating = sessionQualityRating;
      if (supportRating > 0) body.supportRating = supportRating;
      if (comment.trim()) body.comment = comment.trim();

      const res = await fetch(`/api/sessions/${sessionId}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to submit evaluation.");
      }

      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal labelledBy="eval-modal-title">
      <Card className="relative z-50 w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900/95 p-6 text-slate-100 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <CardHeader className="border-b pb-4">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle id="eval-modal-title" className="text-lg">
                Evaluate Mentor Session
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                {sessionTopic ?? "Mentoring Session"} &bull; {batchName} &bull;{" "}
                {new Date(sessionDate).toLocaleDateString()}
              </CardDescription>
            </div>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close modal"
              className="text-muted-foreground hover:text-foreground text-xl leading-none"
            >
              ✕
            </button>
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5" id="eval-form">
            <div className="flex flex-col gap-1">
              <label htmlFor="eval-mentor" className="text-sm font-medium text-foreground">
                Mentor for this session
              </label>
              <select
                id="eval-mentor"
                value={mentorId}
                onChange={(event) => setMentorId(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                {mentors.map((mentor) => (
                  <option key={mentor.id} value={mentor.id}>
                    {mentor.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Required */}
            <StarRating
              id="eval-overall"
              label="Overall Rating *"
              value={overallRating}
              onChange={setOverallRating}
            />

            <div className="border-t pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StarRating
                id="eval-communication"
                label="Communication"
                value={communicationRating}
                onChange={setCommunicationRating}
              />
              <StarRating
                id="eval-helpfulness"
                label="Helpfulness"
                value={helpfulnessRating}
                onChange={setHelpfulnessRating}
              />
              <StarRating
                id="eval-session-quality"
                label="Session Quality"
                value={sessionQualityRating}
                onChange={setSessionQualityRating}
              />
              <StarRating
                id="eval-support"
                label="Support & Availability"
                value={supportRating}
                onChange={setSupportRating}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="eval-comment"
                className="text-sm font-medium text-foreground"
              >
                Comment{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </label>
              <textarea
                id="eval-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Share your experience. Please do not include names, student IDs, or email addresses."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {comment.length} / 2000
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-500/10 rounded px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3 justify-end border-t pt-4">
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 font-medium"
              >
                {submitting ? "Submitting…" : "Submit Evaluation"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </ModalPortal>
  );
}
