"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Input, Label, Skeleton } from "@commandry/ui";

type Article = {
  id: string;
  title: string;
  slug: string;
  category: string;
  collection: string | null;
  status: string;
  visibility: string;
  body: string;
  excerpt: string;
  tags: string[];
  version: number;
  updatedAt: string;
};
type Detail = {
  article: Article;
  versions: { version: number; changeSummary: string | null; createdAt: string }[];
  related: Article[];
  approvalStatus: string | null;
};

const CATEGORIES = [
  "policy",
  "sop",
  "guide",
  "training_manual",
  "department_manual",
  "promotion_requirements",
  "rank_guide",
  "vehicle_policy",
  "radio_procedure",
  "cad_procedure",
  "administrative",
  "faq",
  "article",
];
const statusTone: Record<string, "success" | "warning" | "accent" | "neutral"> = {
  published: "success",
  draft: "neutral",
  review: "accent",
  archived: "warning",
  approved: "accent",
};

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error((json as { error?: { message?: string } }).error?.message ?? "Request failed");
  return json;
}

export function KnowledgeView({
  canManage,
  initialNew,
}: {
  canManage: boolean;
  initialNew?: boolean;
}) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(Boolean(initialNew) && canManage);
  const [form, setForm] = useState({
    title: "",
    category: "policy",
    customCategory: "",
    collection: "",
    visibility: "organization",
    body: "",
    tags: "",
  });
  const [editBody, setEditBody] = useState("");
  const [collections, setCollections] = useState<{ name: string; count: number }[]>([]);
  const [collectionFilter, setCollectionFilter] = useState("");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (category) params.set("category", category);
      if (collectionFilter) params.set("collection", collectionFilter);
      const [json, cols] = await Promise.all([
        api(`/api/knowledge?${params.toString()}`),
        api("/api/knowledge/collections"),
      ]);
      setArticles(json.articles);
      setCollections(cols.collections);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [query, category, collectionFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = async (id: string) => {
    try {
      const d = await api(`/api/knowledge/${id}`);
      setDetail(d);
      setEditBody(d.article.body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const json = await api("/api/knowledge", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          category: form.category === "__custom" ? form.customCategory : form.category,
          collection: form.collection || undefined,
          visibility: form.visibility,
          body: form.body,
          tags: form.tags ? form.tags.split(",").map((t) => t.trim()) : [],
        }),
      });
      setCreating(false);
      setForm({
        title: "",
        category: "policy",
        customCategory: "",
        collection: "",
        visibility: "organization",
        body: "",
        tags: "",
      });
      await load();
      await open(json.article.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const transition = (to: string) =>
    detail &&
    api(`/api/knowledge/${detail.article.id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "transition", to }),
    })
      .then(() => open(detail.article.id))
      .then(load)
      .catch((e) => setError(e.message));
  const save = () =>
    detail &&
    api(`/api/knowledge/${detail.article.id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "update", body: editBody, changeSummary: "Edited content" }),
    })
      .then(() => open(detail.article.id))
      .then(load)
      .catch((e) => setError(e.message));
  const submitApproval = () =>
    detail &&
    api(`/api/knowledge/${detail.article.id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "submit_approval" }),
    })
      .then(() => open(detail.article.id))
      .then(load)
      .catch((e) => setError(e.message));

  if (loading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--cmd-fg-muted)]">
            Knowledge Platform
          </p>
          <h1 className="font-[family-name:var(--cmd-font-display)] text-3xl">Knowledge</h1>
        </div>
        {canManage ? (
          <Button
            size="sm"
            onClick={() => {
              setCreating((c) => !c);
              setDetail(null);
            }}
          >
            {creating ? "Cancel" : "New article"}
          </Button>
        ) : null}
      </header>

      {error ? (
        <div className="rounded-[var(--cmd-radius)] border border-[var(--cmd-danger)]/40 bg-[var(--cmd-danger)]/10 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      {creating ? (
        <form onSubmit={create} className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="k-title">Title</Label>
              <Input
                id="k-title"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Pursuit Policy"
              />
            </div>
            <div>
              <Label htmlFor="k-cat">Category</Label>
              <select
                id="k-cat"
                className="h-10 w-full rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-2 text-sm"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </option>
                ))}
                <option value="__custom">Custom category…</option>
              </select>
              {form.category === "__custom" ? (
                <Input
                  className="mt-2"
                  value={form.customCategory}
                  onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
                  placeholder="e.g. canine_unit"
                />
              ) : null}
            </div>
            <div>
              <Label htmlFor="k-collection">Collection (folder)</Label>
              <Input
                id="k-collection"
                value={form.collection}
                onChange={(e) => setForm({ ...form, collection: e.target.value })}
                placeholder="e.g. Field Operations"
                list="k-collections"
              />
              <datalist id="k-collections">
                {collections.map((c) => (
                  <option key={c.name} value={c.name} />
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="k-vis">Visibility</Label>
              <select
                id="k-vis"
                className="h-10 w-full rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-2 text-sm"
                value={form.visibility}
                onChange={(e) => setForm({ ...form, visibility: e.target.value })}
              >
                {["organization", "staff", "department", "public"].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="k-tags">Tags (comma-separated)</Label>
              <Input
                id="k-tags"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="pursuit, driving"
              />
            </div>
          </div>
          <div className="mt-3">
            <Label htmlFor="k-body">Content</Label>
            <textarea
              id="k-body"
              className="min-h-40 w-full rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] p-2 text-sm"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Write the policy/SOP content…"
            />
          </div>
          <Button type="submit" className="mt-3">
            Create draft
          </Button>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search knowledge…"
          className="max-w-xs"
        />
        <select
          className="h-10 rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-2 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        {collections.length > 0 ? (
          <select
            className="h-10 rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-2 text-sm"
            value={collectionFilter}
            onChange={(e) => setCollectionFilter(e.target.value)}
          >
            <option value="">All collections</option>
            {collections.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.count})
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <ul className="space-y-2">
          {articles.length === 0 ? (
            <li className="text-sm text-[var(--cmd-fg-muted)]">No articles yet.</li>
          ) : null}
          {articles.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => open(a.id)}
                className={`w-full rounded-[var(--cmd-radius-xl)] p-3 text-left ${detail?.article.id === a.id ? "cmd-glass-strong" : "cmd-glass hover:bg-[var(--cmd-bg-muted)]"}`}
              >
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone[a.status] ?? "neutral"}>{a.status}</Badge>
                  <span className="text-xs text-[var(--cmd-fg-muted)]">
                    {a.category.replace(/_/g, " ")} · v{a.version}
                  </span>
                </div>
                <p className="mt-1 font-medium">{a.title}</p>
                <p className="text-xs text-[var(--cmd-fg-muted)]">{a.excerpt}</p>
              </button>
            </li>
          ))}
        </ul>

        {detail ? (
          <article className="cmd-glass rounded-[var(--cmd-radius-xl)] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone[detail.article.status] ?? "neutral"}>
                {detail.article.status}
              </Badge>
              <span className="text-xs text-[var(--cmd-fg-muted)]">
                {detail.article.category.replace(/_/g, " ")} · v{detail.article.version} ·{" "}
                {detail.article.visibility}
                {detail.article.collection ? ` · ${detail.article.collection}` : ""}
              </span>
              {detail.approvalStatus ? (
                <Badge tone={detail.approvalStatus === "COMPLETED" ? "success" : "accent"}>
                  {detail.approvalStatus === "COMPLETED" ? "approved" : "awaiting approval"}
                </Badge>
              ) : null}
            </div>
            <h2 className="mt-1 font-[family-name:var(--cmd-font-display)] text-2xl">
              {detail.article.title}
            </h2>
            {canManage ? (
              <div className="mt-3">
                <textarea
                  className="min-h-48 w-full rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] p-2 text-sm"
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={save}>
                    Save version
                  </Button>
                  {detail.article.status === "draft" && !detail.approvalStatus ? (
                    <Button size="sm" variant="outline" onClick={submitApproval}>
                      Submit for approval
                    </Button>
                  ) : null}
                  {detail.article.status !== "published" ? (
                    <Button
                      size="sm"
                      onClick={() => transition("published")}
                      disabled={
                        Boolean(detail.approvalStatus) && detail.approvalStatus !== "COMPLETED"
                      }
                    >
                      Publish
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => transition("archived")}>
                      Archive
                    </Button>
                  )}
                </div>
                {detail.approvalStatus && detail.approvalStatus !== "COMPLETED" ? (
                  <p className="mt-1 text-xs text-[var(--cmd-fg-muted)]">
                    Routed to the Workflow Platform for approval — publish unlocks once approved.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 whitespace-pre-wrap text-sm">{detail.article.body}</p>
            )}

            {detail.related.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">
                  Related
                </p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {detail.related.map((r) => (
                    <li key={r.id}>
                      <button
                        onClick={() => open(r.id)}
                        className="rounded-[var(--cmd-radius-pill)] bg-[var(--cmd-bg-muted)] px-2.5 py-1 text-xs hover:underline"
                      >
                        {r.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {canManage && detail.versions.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">
                  Version history
                </p>
                <ul className="mt-1 space-y-1">
                  {detail.versions.map((v) => (
                    <li
                      key={v.version}
                      className="flex items-center justify-between text-xs text-[var(--cmd-fg-muted)]"
                    >
                      <span>
                        v{v.version} — {v.changeSummary}
                      </span>
                      {v.version !== detail.article.version ? (
                        <button
                          className="hover:underline"
                          onClick={() =>
                            api(`/api/knowledge/${detail.article.id}`, {
                              method: "PATCH",
                              body: JSON.stringify({ action: "rollback", toVersion: v.version }),
                            }).then(() => open(detail.article.id))
                          }
                        >
                          rollback
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </article>
        ) : (
          <div className="cmd-glass flex items-center justify-center rounded-[var(--cmd-radius-xl)] p-8 text-sm text-[var(--cmd-fg-muted)]">
            Select an article to read it.
          </div>
        )}
      </div>
    </div>
  );
}
