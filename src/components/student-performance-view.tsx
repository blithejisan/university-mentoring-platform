"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface CategoryAverage {
  category: string;
  averageScore: number;
  count: number;
}

interface RecordItem {
  id: string;
  batchName: string;
  mode: string;
  category: string | null;
  score: number;
  recordedBy: string;
  recordedAt: string;
}

interface ChartItem {
  date: string;
  score: number;
  category: string;
}

interface PerformanceData {
  studentId: string;
  universityIdNumber: string;
  email: string;
  overallAverage: number;
  totalRecords: number;
  categoryAverages: CategoryAverage[];
  records: RecordItem[];
  chartData: ChartItem[];
}

interface Props {
  studentUserId: string;
}

export function StudentPerformanceView({ studentUserId }: Props) {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchPerformance = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/reports/students/${studentUserId}/performance`);
        if (!res.ok) throw new Error("Failed to load performance data.");
        const json = await res.json();
        if (isMounted) {
          setData(json.performance);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          if (err instanceof Error) {
            setError(err.message);
          } else {
            setError("Failed to load performance.");
          }
          setLoading(false);
        }
      }
    };

    fetchPerformance();
    return () => {
      isMounted = false;
    };
  }, [studentUserId]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading performance records...</p>;
  if (error || !data) return <p className="text-sm text-red-500">{error || "Data unavailable."}</p>;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="ai-neon-card">
          <CardHeader className="pb-2">
            <CardDescription>Overall Score Average</CardDescription>
            <CardTitle className="text-3xl font-bold text-primary">
              {data.overallAverage} <span className="text-sm font-normal text-muted-foreground">/ 100</span>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="ai-neon-card">
          <CardHeader className="pb-2">
            <CardDescription>Total Evaluations</CardDescription>
            <CardTitle className="text-3xl font-bold text-foreground">{data.totalRecords}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="ai-neon-card">
          <CardHeader className="pb-2">
            <CardDescription>Categories Evaluated</CardDescription>
            <CardTitle className="text-3xl font-bold text-foreground">
              {data.categoryAverages.length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Category Breakdown & Trend Chart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Breakdown */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Category Averages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.categoryAverages.length === 0 ? (
              <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">No evaluations recorded yet.</p>
            ) : (
              data.categoryAverages.map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">{cat.category}</span>
                    <span className="font-bold text-primary">{cat.averageScore} / 100</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${Math.min(cat.averageScore, 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recharts Performance Trend Line Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Performance Trend</CardTitle>
            <CardDescription>Score timeline over recent evaluations</CardDescription>
          </CardHeader>
          <CardContent>
            {data.chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-10">
                No evaluation trend data available.
              </p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.chartData}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#cbd5e1", fontSize: 12 }} axisLine={{ stroke: "#475569" }} tickLine={{ stroke: "#475569" }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#cbd5e1", fontSize: 12 }} axisLine={{ stroke: "#475569" }} tickLine={{ stroke: "#475569" }} />
                    <Tooltip
                      formatter={(val: unknown) => [`${val ?? 0} / 100`, "Score"]}
                      labelFormatter={(label) => `Date: ${label}`}
                      contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: 8, color: "#f1f5f9" }}
                      labelStyle={{ color: "#f1f5f9" }}
                      itemStyle={{ color: "#67e8f9" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full Records Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Evaluation Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y border rounded-md">
            {data.records.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground italic">
                No performance records logged yet.
              </p>
            ) : (
              data.records.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <span className="font-semibold text-foreground">{r.category || "Overall"}</span>
                    <p className="text-xs text-muted-foreground">
                      Batch: {r.batchName} • Evaluator: {r.recordedBy} • Date: {new Date(r.recordedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="font-bold text-base text-primary">{r.score} / 100</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
