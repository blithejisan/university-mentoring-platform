"use client";

import { useEffect, useState } from "react";
import { Mail, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface MentorContact {
  user: {
    name: string | null;
    universityIdNumber: string;
    email: string;
  };
  department: {
    name: string;
    code: string;
  };
}

interface Props {
  role: "ADMIN" | "MODERATOR" | "MENTOR";
}

export function MentorDirectory({ role }: Props) {
  const [mentors, setMentors] = useState<MentorContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadMentors() {
      try {
        const response = await fetch("/api/mentors/approved");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load the mentor directory.");
        if (active) setMentors(data.mentors ?? []);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load the mentor directory.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadMentors();
    return () => { active = false; };
  }, []);

  return (
    <section className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-[#edf5ee] p-2.5 text-[#276244]"><UsersRound className="size-5" /></span>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Approved mentors</h2>
          <p className="mt-1 text-sm text-slate-600">
            {role === "ADMIN" ? "University-wide mentor contacts." : "Approved mentor contacts in your department."}
          </p>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {loading ? (
        <p className="py-6 text-center text-sm text-slate-600">Loading mentor directory...</p>
      ) : mentors.length === 0 ? (
        <Card className="border-dashed border-slate-300 bg-slate-50 shadow-none">
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <UsersRound className="size-5 text-slate-500" />
            <p className="text-sm font-medium text-slate-700">No approved mentors found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {mentors.map(({ user, department }) => (
            <article key={user.universityIdNumber} className="flex min-w-0 flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-slate-900">{user.name || "Mentor"}</h3>
                <p className="mt-0.5 text-sm text-slate-600">ID: {user.universityIdNumber}</p>
                <p className="mt-1 break-all text-sm text-slate-700">{user.email}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">{department.name} ({department.code})</p>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0 border-[#bfd2c3] text-[#205b3d] hover:bg-[#edf5ee]">
                <a href={`mailto:${user.email}`} aria-label={`Email ${user.name || "mentor"}`}>
                  <Mail aria-hidden="true" />
                  Email
                </a>
              </Button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
