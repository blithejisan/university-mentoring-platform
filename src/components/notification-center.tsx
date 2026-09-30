"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

type Preferences = {
  inAppNotices: boolean;
  emailNotices: boolean;
  inAppSessions: boolean;
  emailSessionReminders: boolean;
  inAppRemarks: boolean;
  emailRemarks: boolean;
};

const PREFERENCE_LABELS: Array<{ key: keyof Preferences; label: string }> = [
  { key: "inAppNotices", label: "In-app notices" },
  { key: "emailNotices", label: "Notice emails" },
  { key: "inAppSessions", label: "In-app sessions" },
  { key: "emailSessionReminders", label: "Session reminder emails" },
  { key: "inAppRemarks", label: "In-app remarks" },
  { key: "emailRemarks", label: "Remark emails" },
];

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingPreference, setSavingPreference] = useState<keyof Preferences | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch("/api/notifications").then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Unable to load notifications.");
        return payload as { notifications: NotificationItem[]; unreadCount: number };
      }),
      fetch("/api/me/notification-preferences").then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Unable to load preferences.");
        return payload.preferences as Preferences;
      }),
    ]).then(([inbox, loadedPreferences]) => {
      if (!active) return;
      setNotifications(inbox.notifications);
      setUnreadCount(inbox.unreadCount);
      setPreferences(loadedPreferences);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load notifications.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [open]);

  async function markRead(notification: NotificationItem) {
    if (notification.readAt) return;
    try {
      const response = await fetch(`/api/notifications/${notification.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      });
      if (!response.ok) return;
      setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch {
      setError("Unable to update notification state.");
    }
  }

  async function updatePreference(key: keyof Preferences, value: boolean) {
    if (!preferences) return;
    setSavingPreference(key);
    setError(null);
    try {
      const response = await fetch("/api/me/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to save preference.");
      setPreferences(payload.preferences);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Unable to save preference.");
    } finally {
      setSavingPreference(null);
    }
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="relative size-9 border-slate-300 bg-white p-0 text-slate-700"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell aria-hidden="true" className="size-4" />
        {unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-4 text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </Button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-md border border-slate-200 bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setOpen(false)}>Close</Button>
          </div>
          {error && <p className="mt-2 text-xs text-rose-700" role="alert">{error}</p>}
          {loading ? <p className="py-4 text-sm text-slate-500" role="status">Loading notifications...</p> : notifications.length === 0 ? <p className="py-4 text-sm text-slate-500">You are all caught up.</p> : (
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
              {notifications.map((notification) => (
                <li key={notification.id} className={`py-2 ${notification.readAt ? "" : "bg-emerald-50/70"}`}>
                  <Link
                    href={notification.href ?? "/"}
                    onClick={() => { void markRead(notification); setOpen(false); }}
                    className="block rounded px-2 py-1 hover:bg-slate-50"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900">{notification.title}</span>
                      {!notification.readAt && <span aria-label="Unread" className="mt-1 size-2 shrink-0 rounded-full bg-emerald-600" />}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-slate-600">{notification.message}</span>
                    <time className="mt-1 block text-[11px] text-slate-500" dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString()}</time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <details className="mt-2 border-t border-slate-200 pt-2">
            <summary className="cursor-pointer text-xs font-medium text-slate-700">Notification preferences</summary>
            <fieldset disabled={!preferences || savingPreference !== null} className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
              <legend className="sr-only">Choose how to receive notices, sessions, and remarks</legend>
              {PREFERENCE_LABELS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-xs text-slate-700">
                  <input type="checkbox" checked={preferences?.[key] ?? true} onChange={(event) => void updatePreference(key, event.target.checked)} />
                  {label}
                </label>
              ))}
            </fieldset>
            {savingPreference && <p className="mt-1 text-[11px] text-slate-500" role="status">Saving preference...</p>}
          </details>
        </div>
      )}
    </div>
  );
}
