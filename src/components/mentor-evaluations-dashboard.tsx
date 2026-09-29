"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface EvaluationRecord {
  id: string;
  overallRating: number;
  communicationRating: number | null;
  helpfulnessRating: number | null;
  sessionQualityRating: number | null;
  supportRating: number | null;
  comment: string | null;
  createdAt: string;
  session: {
    id: string;
    date: string;
    topic: string | null;
    batch: { id: string; name: string };
  };
  student: {
    user: { universityIdNumber: string; email: string };
  };
}

interface Stats {
  totalEvaluations: number;
  averageOverall: number | null;
  averageCommunication: number | null;
  averageHelpfulness: number | null;
  averageSessionQuality: number | null;
  averageSupport: number | null;
}

interface ApiResponse {
  evaluations: EvaluationRecord[];
  stats: Stats;
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
  const [data, setData] = useState<ApiResponse | null>(null);
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

  const { evaluations, stats } = data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          My Evaluations
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Feedback submitted by students for your mentoring sessions.
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="col-span-2 sm:col-span-3 lg:col-span-2 flex flex-col justify-center items-center py-4 bg-primary/5 border-primary/20">
          <p className="text-4xl font-bold text-primary">
            {stats.totalEvaluations}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Total Evaluations
          </p>
        </Card>
        <StatCard label="Overall" value={stats.averageOverall} />
        <StatCard label="Communication" value={stats.averageCommunication} />
        <StatCard label="Helpfulness" value={stats.averageHelpfulness} />
        <StatCard label="Session Quality" value={stats.averageSessionQuality} />
      </div>

      {/* Evaluation list */}
      {evaluations.length === 0 ? (
        <Card>
          <CardContent className="py-7 text-center text-sm font-medium text-slate-700">
            No evaluations received yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Evaluation History</CardTitle>
            <CardDescription>
              Most recent evaluations from students.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {evaluations.map((ev) => (
                <div key={ev.id} className="px-5 py-4 text-sm hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {ev.session.topic ?? "Mentoring Session"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ev.session.batch.name} &bull;{" "}
                        {new Date(ev.session.date).toLocaleDateString()} &bull;
                        Student: {ev.student.user.universityIdNumber}
                      </p>

                      {/* Sub-ratings */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                        {ev.communicationRating !== null && (
                          <span className="text-xs text-muted-foreground">
                            Communication:{" "}
                            <span className="text-amber-500 font-medium">
                              {"★".repeat(ev.communicationRating)}
                            </span>
                          </span>
                        )}
                        {ev.helpfulnessRating !== null && (
                          <span className="text-xs text-muted-foreground">
                            Helpfulness:{" "}
                            <span className="text-amber-500 font-medium">
                              {"★".repeat(ev.helpfulnessRating)}
                            </span>
                          </span>
                        )}
                        {ev.sessionQualityRating !== null && (
                          <span className="text-xs text-muted-foreground">
                            Session Quality:{" "}
                            <span className="text-amber-500 font-medium">
                              {"★".repeat(ev.sessionQualityRating)}
                            </span>
                          </span>
                        )}
                        {ev.supportRating !== null && (
                          <span className="text-xs text-muted-foreground">
                            Support:{" "}
                            <span className="text-amber-500 font-medium">
                              {"★".repeat(ev.supportRating)}
                            </span>
                          </span>
                        )}
                      </div>

                      {ev.comment && (
                        <blockquote className="mt-2 border-l-2 border-primary/30 pl-3 text-xs italic text-muted-foreground">
                          &ldquo;{ev.comment}&rdquo;
                        </blockquote>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <StarDisplay value={ev.overallRating} />
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(ev.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
