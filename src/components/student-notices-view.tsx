"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bell, Calendar, Clock, Tag, Info, ChevronRight } from "lucide-react";

interface NoticeAuthor {
  universityIdNumber: string;
  email: string;
  role: string;
}

interface Notice {
  id: string;
  title: string;
  message: string;
  targetType: "ALL" | "DEPARTMENT" | "BATCH" | "STUDENT";
  targetBatch?: { id: string; name: string } | null;
  targetDepartment?: { id: string; name: string; code: string } | null;
  createdBy: NoticeAuthor;
  publishAt: string | null;
  expiryAt: string | null;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
}

const TARGET_LABELS: Record<string, string> = {
  ALL: "University-wide",
  DEPARTMENT: "Department",
  BATCH: "Batch",
  STUDENT: "Personal",
};

const TARGET_COLORS: Record<string, string> = {
  ALL: "bg-blue-100 text-blue-700",
  DEPARTMENT: "bg-purple-100 text-purple-700",
  BATCH: "bg-green-100 text-green-700",
  STUDENT: "bg-orange-100 text-orange-700",
};

function isExpired(notice: Notice): boolean {
  if (!notice.expiryAt) return false;
  return new Date(notice.expiryAt) < new Date();
}

function NoticeCard({ notice, onOpen }: { notice: Notice; onClick?: () => void; onOpen: (n: Notice) => void }) {
  const expired = isExpired(notice);

  return (
    <div
      className={`border rounded-lg p-4 hover:bg-muted/40 transition-colors cursor-pointer group ${
        expired ? "opacity-60" : ""
      }`}
      onClick={() => onOpen(notice)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen(notice)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${TARGET_COLORS[notice.targetType] ?? "bg-gray-100 text-gray-700"}`}
            >
              {TARGET_LABELS[notice.targetType] ?? notice.targetType}
              {notice.targetType === "BATCH" && notice.targetBatch ? ` · ${notice.targetBatch.name}` : ""}
            </span>
            {expired && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                Expired
              </span>
            )}
          </div>
          <h3 className="font-semibold text-sm text-foreground truncate">{notice.title}</h3>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notice.message}</p>
        </div>
        <ChevronRight className="size-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors mt-1" />
      </div>
      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="size-3" />
          {new Date(notice.createdAt).toLocaleDateString()}
        </span>
        {notice.expiryAt && (
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            Expires {new Date(notice.expiryAt).toLocaleDateString()}
          </span>
        )}
        <span className="flex items-center gap-1 ml-auto">
          <Tag className="size-3" />
          {notice.createdBy.role}
        </span>
      </div>
    </div>
  );
}

function NoticeDetailDialog({ notice, open, onClose }: { notice: Notice | null; open: boolean; onClose: () => void }) {
  if (!notice) return null;
  const expired = isExpired(notice);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${TARGET_COLORS[notice.targetType] ?? "bg-gray-100 text-gray-700"}`}
            >
              {TARGET_LABELS[notice.targetType]}
              {notice.targetType === "BATCH" && notice.targetBatch ? ` · ${notice.targetBatch.name}` : ""}
              {notice.targetType === "DEPARTMENT" && notice.targetDepartment
                ? ` · ${notice.targetDepartment.name}`
                : ""}
            </span>
            {expired && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                Expired
              </span>
            )}
          </div>
          <DialogTitle>{notice.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{notice.message}</p>

          <div className="border-t pt-3 space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Posted by</span>
              <span className="font-medium text-foreground">
                {notice.createdBy.universityIdNumber} ({notice.createdBy.role})
              </span>
            </div>
            <div className="flex justify-between">
              <span>Posted on</span>
              <span className="font-medium text-foreground">
                {new Date(notice.createdAt).toLocaleString()}
              </span>
            </div>
            {notice.expiryAt && (
              <div className="flex justify-between">
                <span>Expires</span>
                <span className={`font-medium ${expired ? "text-red-500" : "text-foreground"}`}>
                  {new Date(notice.expiryAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function StudentNoticesView() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchNotices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/notices");
      if (!res.ok) throw new Error("Failed to load notices.");
      const json = await res.json();
      setNotices(json.notices ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load notices.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotices(); }, [fetchNotices]);

  const handleOpen = (n: Notice) => {
    setSelectedNotice(n);
    setDialogOpen(true);
  };

  const active = notices.filter((n) => !isExpired(n));
  const expired = notices.filter((n) => isExpired(n));

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-5 text-primary" />
            Notices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading notices...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-5 text-primary" />
            Notices
            {active.length > 0 && (
              <span className="ml-auto text-xs font-medium bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                {active.length} active
              </span>
            )}
          </CardTitle>
          <CardDescription>Announcements and notices relevant to you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <p className="text-sm text-red-500">{error}</p>}

          {notices.length === 0 && !error && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="rounded-full bg-slate-100 p-3 text-slate-600"><Info className="size-5" /></span>
              <p className="text-sm font-medium text-slate-700">No notices for you right now.</p>
            </div>
          )}

          {active.map((n) => (
            <NoticeCard key={n.id} notice={n} onOpen={handleOpen} />
          ))}

          {expired.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mt-4 mb-2 uppercase tracking-wide">
                Expired Notices
              </p>
              {expired.map((n) => (
                <NoticeCard key={n.id} notice={n} onOpen={handleOpen} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <NoticeDetailDialog
        notice={selectedNotice}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}

// Suppress unused import
void Button;
