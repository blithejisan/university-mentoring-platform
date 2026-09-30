"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TemplateKey = "NOTICE" | "REMARK" | "SESSION_REMINDER";
type Template = { key: TemplateKey; subject: string; body: string; customized: boolean };
const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  NOTICE: "Notice",
  REMARK: "Remark",
  SESSION_REMINDER: "Session reminder",
};

export function EmailTemplateSettings() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedKey, setSelectedKey] = useState<TemplateKey>("NOTICE");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const selected = templates.find((template) => template.key === selectedKey);

  useEffect(() => {
    let active = true;
    fetch("/api/email-templates")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Unable to load email templates.");
        if (active) setTemplates(payload.templates);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load email templates.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function updateSelected(value: Partial<Template>) {
    setTemplates((items) => items.map((template) => template.key === selectedKey ? { ...template, ...value } : template));
    setSaved(false);
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch(`/api/email-templates/${selectedKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: selected.subject, body: selected.body }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to save template.");
      setTemplates((items) => items.map((template) => template.key === selectedKey ? { ...payload.template, customized: true } : template));
      setSaved(true);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Unable to save template.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-md shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Communication email templates</CardTitle>
        <CardDescription>Templates apply only to your university.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Email template">
          {(Object.keys(TEMPLATE_LABELS) as TemplateKey[]).map((key) => (
            <Button key={key} type="button" size="sm" variant={selectedKey === key ? "default" : "outline"} role="tab" aria-selected={selectedKey === key} onClick={() => { setSelectedKey(key); setSaved(false); }}>
              {TEMPLATE_LABELS[key]}
            </Button>
          ))}
        </div>
        {loading ? <p className="text-sm text-muted-foreground" role="status">Loading templates...</p>
          : error && !selected ? <p className="text-sm text-rose-700" role="alert">{error}</p>
            : selected && (
              <div className="space-y-3">
                <div className="space-y-1"><Label htmlFor="email-template-subject">Subject</Label><Input id="email-template-subject" value={selected.subject} onChange={(event) => updateSelected({ subject: event.target.value })} maxLength={200} /></div>
                <div className="space-y-1"><Label htmlFor="email-template-body">Body</Label><Textarea id="email-template-body" value={selected.body} onChange={(event) => updateSelected({ body: event.target.value })} rows={8} maxLength={5000} /></div>
                {error && <p className="text-sm text-rose-700" role="alert">{error}</p>}
                {saved && <p className="text-sm text-emerald-700" role="status">Template saved.</p>}
                <Button type="button" onClick={() => void save()} disabled={saving || !selected.subject.trim() || !selected.body.trim()}>{saving ? "Saving..." : "Save template"}</Button>
              </div>
            )}
      </CardContent>
    </Card>
  );
}
