"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Input, Label, Skeleton } from "@commandry/ui";

type Block = { id: string; type: string; config: Record<string, unknown>; visibility: string };
type Page = {
  id: string;
  slug: string;
  title: string;
  status: string;
  visibility: string;
  system: boolean;
  blocks: Block[];
};
type Settings = {
  branding: { name: string; description?: string; accentColor: string; discordInvite?: string };
  published: boolean;
};

const ADDABLE_BLOCKS = [
  "hero",
  "text",
  "cta",
  "stats",
  "announcements",
  "staff_directory",
  "department_list",
  "upcoming_patrols",
  "upcoming_sessions",
  "application_list",
  "server_status",
  "contact_form",
  "divider",
  "spacer",
];
const TEXT_FIELDS: Record<string, string[]> = {
  hero: ["heading", "subheading", "ctaLabel", "ctaHref"],
  text: ["heading", "body"],
  cta: ["heading", "ctaLabel", "ctaHref"],
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

export function WebsiteBuilder({ orgSlug }: { orgSlug: string }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newPage, setNewPage] = useState("");
  const [newBlock, setNewBlock] = useState("hero");

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([api("/api/website/settings"), api("/api/website/pages")]);
      setSettings(s);
      setPages(p.pages);
      if (!selected && p.pages.length) setSelected(p.pages[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    void load();
  }, [load]);

  const flash = (t: string) => {
    setMessage(t);
    setTimeout(() => setMessage(null), 3000);
  };
  const patchSettings = (body: Record<string, unknown>) =>
    api("/api/website/settings", { method: "PATCH", body: JSON.stringify(body) })
      .then(() => {
        flash("Saved.");
        void load();
      })
      .catch((e) => setError(e.message));
  const patchPage = (id: string, body: Record<string, unknown>) =>
    api(`/api/website/pages/${id}`, { method: "PATCH", body: JSON.stringify(body) })
      .then(() => {
        void load();
      })
      .catch((e) => setError(e.message));

  const page = pages.find((p) => p.id === selected) ?? null;

  const saveBlocks = (blocks: Block[]) => {
    if (!page) return;
    setPages(pages.map((p) => (p.id === page.id ? { ...p, blocks } : p)));
    void patchPage(page.id, { blocks });
  };
  const addBlock = () =>
    page &&
    saveBlocks([
      ...page.blocks,
      {
        id: `blk_${Math.random().toString(36).slice(2, 8)}`,
        type: newBlock,
        config: {},
        visibility: "PUBLIC",
      },
    ]);
  const removeBlock = (i: number) => page && saveBlocks(page.blocks.filter((_, idx) => idx !== i));
  const moveBlock = (i: number, dir: -1 | 1) => {
    if (!page) return;
    const j = i + dir;
    if (j < 0 || j >= page.blocks.length) return;
    const b = [...page.blocks];
    [b[i], b[j]] = [b[j]!, b[i]!];
    saveBlocks(b);
  };
  const setBlockConfig = (i: number, key: string, value: string) => {
    if (!page) return;
    const b = page.blocks.map((blk, idx) =>
      idx === i ? { ...blk, config: { ...blk.config, [key]: value } } : blk,
    );
    saveBlocks(b);
  };

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">
            Community Experience
          </p>
          <h1 className="font-[family-name:var(--cmd-font-display)] text-2xl">Website</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={settings?.published ? "success" : "neutral"}>
            {settings?.published ? "live" : "unpublished"}
          </Badge>
          <Button size="sm" onClick={() => patchSettings({ published: !settings?.published })}>
            {settings?.published ? "Unpublish" : "Publish site"}
          </Button>
          {settings?.published ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/c/${orgSlug}`} target="_blank">
                View site
              </Link>
            </Button>
          ) : null}
        </div>
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

      <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
        <h2 className="font-medium">Branding</h2>
        <p className="text-xs text-[var(--cmd-fg-muted)]">
          Propagates across the whole public site automatically.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="b-name">Site name</Label>
            <Input
              id="b-name"
              defaultValue={settings?.branding.name}
              onBlur={(e) => patchSettings({ branding: { name: e.target.value } })}
            />
          </div>
          <div>
            <Label htmlFor="b-accent">Accent color</Label>
            <input
              id="b-accent"
              type="color"
              defaultValue={settings?.branding.accentColor ?? "#FF3B5C"}
              onBlur={(e) => patchSettings({ branding: { accentColor: e.target.value } })}
              className="h-10 w-16 rounded border border-[var(--cmd-border)] bg-transparent"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="b-desc">Description</Label>
            <Input
              id="b-desc"
              defaultValue={settings?.branding.description}
              onBlur={(e) => patchSettings({ branding: { description: e.target.value } })}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <aside className="cmd-glass rounded-[var(--cmd-radius-xl)] p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-[var(--cmd-fg-muted)]">Pages</p>
          <ul className="space-y-1">
            {pages.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelected(p.id)}
                  className={`flex w-full items-center justify-between rounded-[var(--cmd-radius)] px-2 py-1.5 text-sm ${selected === p.id ? "bg-[var(--cmd-bg-muted)]" : ""}`}
                >
                  <span>{p.title}</span>
                  <Badge tone={p.status === "PUBLISHED" ? "success" : "neutral"}>
                    {p.status.toLowerCase().slice(0, 4)}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
          <form
            className="mt-3 flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newPage) return;
              void api("/api/website/pages", {
                method: "POST",
                body: JSON.stringify({ title: newPage }),
              })
                .then(() => {
                  setNewPage("");
                  void load();
                })
                .catch((err) => setError(err.message));
            }}
          >
            <Input
              value={newPage}
              onChange={(e) => setNewPage(e.target.value)}
              placeholder="New page"
              className="h-8 text-sm"
            />
            <Button size="sm" type="submit">
              +
            </Button>
          </form>
        </aside>

        <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
          {!page ? (
            <p className="text-sm text-[var(--cmd-fg-muted)]">Select a page.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-medium">{page.title}</h2>
                <div className="flex items-center gap-2">
                  <select
                    className="h-8 rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-2 text-sm"
                    value={page.status}
                    onChange={(e) => patchPage(page.id, { status: e.target.value })}
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                  {!page.system ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        api(`/api/website/pages/${page.id}`, { method: "DELETE" })
                          .then(() => {
                            setSelected(null);
                            void load();
                          })
                          .catch((e) => setError(e.message))
                      }
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <select
                  className="h-9 rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-2 text-sm"
                  value={newBlock}
                  onChange={(e) => setNewBlock(e.target.value)}
                >
                  {ADDABLE_BLOCKS.map((b) => (
                    <option key={b} value={b}>
                      {b.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <Button size="sm" onClick={addBlock}>
                  Add block
                </Button>
              </div>

              <ul className="mt-4 space-y-2">
                {page.blocks.map((b, i) => (
                  <li
                    key={b.id}
                    className="rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{b.type.replace(/_/g, " ")}</span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => moveBlock(i, -1)}>
                          ↑
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => moveBlock(i, 1)}>
                          ↓
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => removeBlock(i)}>
                          ✕
                        </Button>
                      </div>
                    </div>
                    {(TEXT_FIELDS[b.type] ?? ["title"]).map((f) => (
                      <Input
                        key={f}
                        className="mt-2 h-8 text-sm"
                        placeholder={f}
                        defaultValue={
                          typeof b.config[f] === "string" ? (b.config[f] as string) : ""
                        }
                        onBlur={(e) => setBlockConfig(i, f, e.target.value)}
                      />
                    ))}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
