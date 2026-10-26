"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type NoticeDetail = {
  title: string;
  message: string;
  targetType: "ALL" | "DEPARTMENT" | "BATCH" | "STUDENT";
  targetBatch?: { name: string } | null;
  targetDepartment?: { name: string } | null;
  createdAt: string;
  createdBy: { universityIdNumber: string; role: string };
  expiryAt: string | null;
};

const TARGET_LABELS: Record<NoticeDetail["targetType"], string> = {
  ALL: "University-wide",
  DEPARTMENT: "Department",
  BATCH: "Batch",
  STUDENT: "Student",
};

export function NoticeDetailDialog({
  notice,
  onClose,
}: {
  notice: NoticeDetail | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={notice !== null} onOpenChange={(open) => !open && onClose()}>
      {notice && (
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-100">
                {TARGET_LABELS[notice.targetType]}
                {notice.targetType === "BATCH" && notice.targetBatch
                  ? ` · ${notice.targetBatch.name}`
                  : ""}
                {notice.targetType === "DEPARTMENT" && notice.targetDepartment
                  ? ` · ${notice.targetDepartment.name}`
                  : ""}
              </span>
            </div>
            <DialogTitle className="break-words">{notice.title}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-md bg-slate-800/60 p-4 text-sm leading-relaxed text-slate-100 whitespace-pre-wrap break-words">
            {notice.message}
          </div>
          <div className="space-y-1 border-t border-slate-700 pt-3 text-xs text-slate-400">
            <div className="flex justify-between gap-4">
              <span>Posted by</span>
              <span className="text-right text-slate-200">
                {notice.createdBy.universityIdNumber} ({notice.createdBy.role})
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Posted on</span>
              <span className="text-right text-slate-200">
                {new Date(notice.createdAt).toLocaleString()}
              </span>
            </div>
            {notice.expiryAt && (
              <div className="flex justify-between gap-4">
                <span>Expires</span>
                <span className="text-right text-slate-200">
                  {new Date(notice.expiryAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
