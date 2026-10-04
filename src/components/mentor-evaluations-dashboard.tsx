"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface Stats {
  totalEvaluations: number;
  averageOverall: number | null;
  averageCommunication: number | null;
  averageHelpfulness: number | null;
  averageSessionQuality: number | null;
}

interface SessionEvaluation {
  session: { date: string; topic: string | null };
  hasEnoughResponses: boolean;
  stats: Stats | null;
  feedback: string[] | null;
}

function StarDisplay({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          className={`text-sm ${s <= Math.round(value) ? "text-amber-400" : "text-muted-foreground/30"}`}
        >
          ★
        </span>
      ))}
      <span className="ml-1 text-sm font-medium text-foreground">
        {value.toFixed(1)}
      </span>
    </span>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <Card className="bg-card">
      <CardHeader className="pb-2">
        <CardDescription className="text-xs">{label}</CardDescription>
        <CardTitle className="text-xl">
          {value !== null ? (
            <StarDisplay value={value} />
          ) : (
            <span className="text-muted-foreground text-base font-normal">No data</span>
          )}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

export function MentorEvaluationsDashboard() {
  const [data, setData] = useState<SessionEvaluation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/mentor-evaluations");
        if (!res.ok) throw new Error("Failed to load evaluations.");
        const json = await res.json();
        if (mounted) {
          setData(json);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load.");
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading)
    return (
      <p className="text-sm text-muted-foreground">Loading evaluations…</p>
    );
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Anonymous Mentor Evaluations
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Student identities are never included. Ratings are aggregated per session, and comments are shown only after at least 3 responses.
        </p>
      </div>

      {data.length === 0 ? (
        <Card>
          <CardContent className="py-7 text-center text-sm font-medium text-slate-700">
            No completed sessions are available for evaluation results.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.map((result, index) => (
            <Card key={`${result.session.date}-${index}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {result.session.topic ?? "Mentoring Session"}
                </CardTitle>
                <CardDescription>
                  {new Date(result.session.date).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!result.hasEnoughResponses || !result.stats ? (
                  <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
                    Ratings and feedback are hidden until at least 3 students
                    have submitted an evaluation for this session.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      <Card className="col-span-2 flex flex-col items-center justify-center bg-primary/5 py-4 sm:col-span-3 lg:col-span-1">
                        <p className="text-4xl font-bold text-primary">
                          {result.stats.totalEvaluations}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Total Evaluations
                        </p>
                      </Card>
                      <StatCard label="Overall" value={result.stats.averageOverall} />
                      <StatCard label="Communication" value={result.stats.averageCommunication} />
                      <StatCard label="Helpfulness" value={result.stats.averageHelpfulness} />
                      <StatCard label="Session Quality" value={result.stats.averageSessionQuality} />
                    </div>

                    {result.feedback === null ? (
                      <p className="text-sm text-muted-foreground">
                        Written comments are hidden until at least 3 students
                        have left feedback.
                      </p>
                    ) : result.feedback.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No written feedback has been submitted.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium">Anonymous Written Feedback</h3>
                        {result.feedback.map((comment, commentIndex) => (
                          <blockquote
                            key={commentIndex}
                            className="border-l-2 border-primary/30 pl-3 text-sm italic text-muted-foreground"
                          >
                            &ldquo;{comment}&rdquo;
                          </blockquote>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
