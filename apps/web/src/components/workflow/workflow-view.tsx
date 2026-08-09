"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Input, Label, Skeleton, cn } from "@commandry/ui";

type Field = {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { label: string; value: string }[];
};
type Template = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  form: { fields: Field[] };
  isBuiltIn: boolean;
};
type Submission = {
  id: string;
  templateName: string;
  category: string;
  status: string;
  currentStageName: string | null;
  submitterName: string;
  canReview: boolean;
  isSubmitter: boolean;
};
type Detail = Submission & {
  data: Record<string, unknown>;
  form: { fields: Field[] };
  timeline: { type: string; actorName: string | null; createdAt: string }[];
  comments: { authorName: string; body: string; visibility: string; createdAt: string }[];
};

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (json as { error?: unknown }).error;
    throw new Error(
      typeof err === "string" ? err : ((err as { message?: string })?.message ?? "Request failed"),
    );
  }
  return json;
}

const statusTone = (s: string) =>
  s === "COMPLETED" || s === "APPROVED"
    ? "success"
    : s === "DENIED" || s === "CANCELLED"
      ? "neutral"
      : s === "REVISION_REQUESTED"
        ? "warning"
        : "accent";

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (["section", "heading", "rich_text"].includes(field.type)) {
    return <p className="mt-2 text-sm font-semibold text-[var(--cmd-fg)]">{field.label}</p>;
  }
  const common =
    "w-full rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-3 py-2 text-sm";
  return (
    <div>
      <Label htmlFor={field.id}>
        {field.label}
        {field.required ? " *" : ""}
      </Label>
      {field.type === "long_text" ? (
        <textarea
          id={field.id}
          rows={3}
          className={common}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === "dropdown" || field.type === "radio" ? (
        <select
          id={field.id}
          className={cn(common, "h-10")}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select…</option>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.type === "toggle" ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />{" "}
          Yes
        </label>
      ) : (
        <Input
          id={field.id}
          type={
            field.type === "number"
              ? "number"
              : field.type === "email"
                ? "email"
                : field.type === "date"
                  ? "date"
                  : "text"
          }
          placeholder={field.placeholder}
          value={String(value ?? "")}
          onChange={(e) =>
            onChange(field.type === "number" ? Number(e.target.value) : e.target.value)
          }
        />
      )}
      {field.helpText ? (
        <p className="mt-1 text-xs text-[var(--cmd-fg-muted)]">{field.helpText}</p>
      ) : null}
    </div>
  );
}

export function WorkflowView({ category, title }: { category?: string; title: string }) {
  const [tab, setTab] = useState<"browse" | "mine" | "review">("browse");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [active, setActive] = useState<{
    template: Template;
    submissionId: string;
    data: Record<string, unknown>;
  } | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const catQ = category ? `&category=${category}` : "";
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, mine, review] = await Promise.all([
        api(`/api/workflow/templates?x=1${catQ}`),
        api(`/api/workflow/submissions?scope=mine${catQ}`),
        api(`/api/workflow/submissions?scope=assigned${catQ}`),
      ]);
      setTemplates(t.templates);
      setSubmissions(tab === "review" ? review.submissions : mine.submissions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [catQ, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const flash = (t: string) => {
    setMessage(t);
    setTimeout(() => setMessage(null), 3500);
  };

  const start = async (template: Template) => {
    try {
      const { id } = await api(`/api/workflow/submissions`, {
        method: "POST",
        body: JSON.stringify({ templateId: template.id }),
      });
      setActive({ template, submissionId: id, data: {} });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
    }
  };

  const submitForm = async () => {
    if (!active) return;
    try {
      await api(`/api/workflow/submissions/${active.submissionId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "submit", data: active.data }),
      });
      setActive(null);
      flash("Submitted.");
      setTab("mine");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    }
  };

  const openDetail = async (id: string) => {
    try {
      setDetail(await api(`/api/workflow/submissions/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  };

  const decide = async (decision: string) => {
    if (!detail) return;
    await api(`/api/workflow/submissions/${detail.id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "decide", decision }),
    })
      .then(() => {
        flash(`Decision recorded: ${decision.toLowerCase()}`);
        void openDetail(detail.id);
        void load();
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  };

  const comment = async (visibility: string) => {
    if (!detail) return;
    const body = window.prompt(
      visibility === "INTERNAL" ? "Internal note (not visible to applicant):" : "Comment:",
    );
    if (!body) return;
    await api(`/api/workflow/submissions/${detail.id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "comment", body, visibility }),
    })
      .then(() => openDetail(detail.id))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  };

  if (loading && templates.length === 0) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">
          Workflow Platform
        </p>
        <h1 className="font-[family-name:var(--cmd-font-display)] text-2xl">{title}</h1>
      </header>

      {error ? (
        <div className="rounded-[var(--cmd-radius)] border border-[var(--cmd-danger)]/40 bg-[var(--cmd-danger)]/10 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-[var(--cmd-radius)] border border-[var(--cmd-success)]/40 bg-[var(--cmd-success)]/10 px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      <div className="flex gap-2">
        {(["browse", "mine", "review"] as const).map((t) => (
          <Button
            key={t}
            size="sm"
            variant={tab === t ? "primary" : "outline"}
            onClick={() => setTab(t)}
          >
            {t === "browse" ? "Templates" : t === "mine" ? "My submissions" : "To review"}
          </Button>
        ))}
      </div>

      {active ? (
        <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-5">
          <h2 className="font-medium">{active.template.name}</h2>
          <p className="text-sm text-[var(--cmd-fg-muted)]">{active.template.description}</p>
          <div className="mt-4 space-y-3">
            {active.template.form.fields.map((field) => (
              <FieldInput
                key={field.id}
                field={field}
                value={active.data[field.id]}
                onChange={(v) => setActive({ ...active, data: { ...active.data, [field.id]: v } })}
              />
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={submitForm}>Submit</Button>
            <Button variant="ghost" onClick={() => setActive(null)}>
              Cancel
            </Button>
          </div>
        </section>
      ) : null}

      {tab === "browse" && !active ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
              <div className="flex items-center gap-2">
                <Badge tone="accent">{t.category}</Badge>
                {t.isBuiltIn ? (
                  <span className="text-xs text-[var(--cmd-fg-muted)]">built-in</span>
                ) : null}
              </div>
              <h3 className="mt-2 font-medium">{t.name}</h3>
              <p className="mt-1 text-sm text-[var(--cmd-fg-muted)]">{t.description}</p>
              <Button size="sm" className="mt-3" onClick={() => start(t)}>
                Start
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {tab !== "browse" && !active ? (
        <ul className="space-y-2">
          {submissions.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--cmd-fg-muted)]">Nothing here yet.</p>
          ) : (
            submissions.map((s) => (
              <li
                key={s.id}
                className="cmd-glass flex items-center justify-between rounded-[var(--cmd-radius-xl)] p-4"
              >
                <div className="flex items-center gap-3">
                  <Badge tone={statusTone(s.status)}>
                    {s.status.replace(/_/g, " ").toLowerCase()}
                  </Badge>
                  <div>
                    <p className="font-medium">{s.templateName}</p>
                    <p className="text-xs text-[var(--cmd-fg-muted)]">
                      by {s.submitterName}
                      {s.currentStageName ? ` · ${s.currentStageName}` : ""}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => openDetail(s.id)}>
                  Open
                </Button>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {detail ? (
        <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge tone={statusTone(detail.status)}>
                {detail.status.replace(/_/g, " ").toLowerCase()}
              </Badge>
              <h2 className="font-medium">{detail.templateName}</h2>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setDetail(null)}>
              Close
            </Button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-[var(--cmd-fg-muted)]">
                Submission
              </p>
              <dl className="space-y-1 text-sm">
                {detail.form.fields
                  .filter((f) => !["section", "heading", "rich_text"].includes(f.type))
                  .map((f) => (
                    <div key={f.id} className="flex justify-between gap-2">
                      <dt className="text-[var(--cmd-fg-muted)]">{f.label}</dt>
                      <dd className="text-right">{String(detail.data[f.id] ?? "—")}</dd>
                    </div>
                  ))}
              </dl>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-[var(--cmd-fg-muted)]">
                Timeline
              </p>
              <ul className="space-y-1 text-xs text-[var(--cmd-fg-muted)]">
                {detail.timeline.map((e, i) => (
                  <li key={i}>
                    {e.type.replace(/_/g, " ").toLowerCase()}{" "}
                    {e.actorName ? `· ${e.actorName}` : ""} ·{" "}
                    {new Date(e.createdAt).toLocaleTimeString()}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase text-[var(--cmd-fg-muted)]">
              Comments
            </p>
            {detail.comments.length === 0 ? (
              <p className="text-sm text-[var(--cmd-fg-muted)]">No comments.</p>
            ) : (
              <ul className="space-y-2">
                {detail.comments.map((c, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium">{c.authorName}</span>
                    {c.visibility === "INTERNAL" ? (
                      <Badge tone="warning">internal</Badge>
                    ) : null} · {c.body}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {detail.canReview && detail.status === "IN_REVIEW" ? (
              <>
                <Button size="sm" onClick={() => decide("APPROVE")}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => decide("REVISE")}>
                  Request revision
                </Button>
                <Button size="sm" variant="ghost" onClick={() => decide("DENY")}>
                  Deny
                </Button>
                <Button size="sm" variant="outline" onClick={() => comment("INTERNAL")}>
                  Internal note
                </Button>
              </>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => comment("APPLICANT")}>
              Add comment
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
