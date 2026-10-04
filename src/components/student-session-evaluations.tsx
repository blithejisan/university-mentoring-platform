"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { EvaluateMentorModal } from "@/components/evaluate-mentor-modal";

interface SessionWithEvaluation {
  id: string;
  date: string;
  topic: string | null;
  status: string;
  batch: { id: string; name: string };
  mentors: {
    id: string;
    universityIdNumber: string;
    hasEvaluated: boolean;
  }[];
}

export function StudentSessionEvaluations() {
  const [sessions, setSessions] = useState<SessionWithEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evaluatingSession, setEvaluatingSession] =
    useState<SessionWithEvaluation | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/students/me/sessions");
      if (!res.ok) throw new Error("Failed to load sessions.");
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleEvaluationSuccess = async () => {
    const sessionTopic =
      evaluatingSession?.topic ?? "Session";
    setEvaluatingSession(null);
    setSuccessMessage(`Evaluation submitted for "${sessionTopic}". Thank you!`);
    await fetchSessions();
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const pendingEval = sessions.filter((session) =>
    session.mentors.some((mentor) => !mentor.hasEvaluated)
  );
  const completed = sessions.filter(
    (session) =>
      session.mentors.length > 0 &&
      session.mentors.every((mentor) => mentor.hasEvaluated)
  );
  const pendingMentorCount = sessions.reduce(
    (count, session) =>
      count + session.mentors.filter((mentor) => !mentor.hasEvaluated).length,
    0
  );
  const submittedMentorCount = sessions.reduce(
    (count, session) =>
      count + session.mentors.filter((mentor) => mentor.hasEvaluated).length,
    0
  );

  return (
    <div className="space-y-6">
      {evaluatingSession && (
        <EvaluateMentorModal
          sessionId={evaluatingSession.id}
          sessionTopic={evaluatingSession.topic}
          sessionDate={evaluatingSession.date}
          batchName={evaluatingSession.batch.name}
          mentors={evaluatingSession.mentors
            .filter((mentor) => !mentor.hasEvaluated)
            .map((mentor) => ({
              id: mentor.id,
              label: mentor.universityIdNumber,
            }))}
          onSuccess={handleEvaluationSuccess}
          onCancel={() => setEvaluatingSession(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Mentor Evaluations
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Rate your mentor&apos;s performance for completed sessions. Your identity is not shown with feedback shared with mentors.
          </p>
        </div>
        {!loading && (
          <span className="text-sm text-muted-foreground">
            {pendingMentorCount} pending &bull; {submittedMentorCount} submitted
          </span>
        )}
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-700 text-sm flex items-center gap-2">
          <span>✓</span>
          <span>{successMessage}</span>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading sessions…</p>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-7 text-center text-sm font-medium text-slate-700">
            No completed sessions found in your batches.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Pending evaluations */}
          {pendingEval.length > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-amber-700">
                  ⏳ Awaiting Your Evaluation
                </CardTitle>
                <CardDescription>
                  These sessions are completed and ready for your feedback.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {pendingEval.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between px-5 py-3 text-sm hover:bg-amber-500/5 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {session.topic ?? "Mentoring Session"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {session.batch.name} &bull;{" "}
                          {new Date(session.date).toLocaleDateString()}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs">
                          {session.mentors.map((mentor) => (
                            <span key={mentor.id} className="text-muted-foreground">
                              {mentor.universityIdNumber}:{" "}
                              {mentor.hasEvaluated ? "Evaluated" : "Awaiting evaluation"}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        id={`eval-btn-${session.id}`}
                        type="button"
                        onClick={() => setEvaluatingSession(session)}
                        className="ml-4 px-4 py-1.5 text-xs font-semibold rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors shrink-0"
                      >
                        Evaluate Mentor(s)
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Already evaluated */}
          {completed.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  ✅ Evaluations Submitted
                </CardTitle>
                <CardDescription>
                  You&apos;ve already rated these sessions.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y max-h-72 overflow-y-auto">
                  {completed.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between px-5 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {session.topic ?? "Mentoring Session"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {session.batch.name} &bull;{" "}
                          {new Date(session.date).toLocaleDateString()}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Mentors: {session.mentors
                            .map((mentor) => mentor.universityIdNumber)
                            .join(", ")}
                        </p>
                      </div>
                      <span className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-700 rounded font-medium shrink-0">
                        Evaluated
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
