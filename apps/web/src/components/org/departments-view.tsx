"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Input, Label, Skeleton } from "@commandry/ui";

type Department = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  accentColor: string | null;
  isActive: boolean;
  memberCount: number;
  leaders: { membershipId: string; name: string }[];
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

export function DepartmentsView() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accent, setAccent] = useState("#3B6CFF");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await api(`/api/departments?archived=1`);
      setDepartments(d.departments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load departments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 4000);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/departments`, {
        method: "POST",
        body: JSON.stringify({ name, description: description || undefined, accentColor: accent }),
      });
      setName("");
      setDescription("");
      flash("Department created.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create department");
    } finally {
      setBusy(false);
    }
  };

  const setArchived = async (id: string, archived: boolean) => {
    await api(`/api/departments/${id}`, { method: "PATCH", body: JSON.stringify({ archived }) })
      .then(() => {
        flash(archived ? "Department archived." : "Department restored.");
        void load();
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"));
  };

  if (loading && departments.length === 0) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">Community</p>
        <h1 className="font-[family-name:var(--cmd-font-display)] text-2xl">Departments</h1>
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

      <form onSubmit={create} className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
        <h2 className="font-medium">Create department</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
          <div>
            <Label htmlFor="dept-name">Name</Label>
            <Input
              id="dept-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Patrol Division"
            />
          </div>
          <div>
            <Label htmlFor="dept-desc">Description</Label>
            <Input
              id="dept-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <Label htmlFor="dept-accent">Color</Label>
            <input
              id="dept-accent"
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="h-10 w-14 rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-transparent"
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>

      {departments.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--cmd-fg-muted)]">
          No departments yet. Create your first department above.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => (
            <div key={d.id} className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: d.accentColor ?? "var(--cmd-accent)" }}
                  />
                  <h3 className="font-medium">{d.name}</h3>
                </div>
                {d.isActive ? null : <Badge tone="neutral">archived</Badge>}
              </div>
              {d.description ? (
                <p className="mt-1 text-sm text-[var(--cmd-fg-muted)]">{d.description}</p>
              ) : null}
              <p className="mt-3 text-xs text-[var(--cmd-fg-muted)]">
                {d.memberCount} member{d.memberCount === 1 ? "" : "s"}
                {d.leaders.length > 0 ? ` · Led by ${d.leaders.map((l) => l.name).join(", ")}` : ""}
              </p>
              <div className="mt-3">
                {d.isActive ? (
                  <Button size="sm" variant="ghost" onClick={() => setArchived(d.id, true)}>
                    Archive
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setArchived(d.id, false)}>
                    Restore
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
