"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@commandry/ui";

type Action = { key: string; label: string; href: string };
type Result = { kind: string; label: string; sublabel?: string; href: string };
type Item = { id: string; group: string; label: string; sublabel?: string; href: string };

/** Universal Ctrl/⌘+K command palette: search + quick actions + navigation. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [actions, setActions] = useState<Action[]>([]);
  const [destinations, setDestinations] = useState<Action[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setActive(0);
      return;
    }
    setTimeout(() => inputRef.current?.focus(), 10);
    void fetch("/api/command-palette")
      .then((r) => (r.ok ? r.json() : { destinations: [], quickActions: [] }))
      .then((j: { destinations: Action[]; quickActions: Action[] }) => {
        setDestinations(j.destinations ?? []);
        setActions(j.quickActions ?? []);
      });
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const id = setTimeout(() => {
      void fetch(`/api/command-palette?q=${encodeURIComponent(query)}`)
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((j: { results: Result[] }) => setResults(j.results ?? []));
    }, 180);
    return () => clearTimeout(id);
  }, [query, open]);

  const filter = (a: Action) => a.label.toLowerCase().includes(query.trim().toLowerCase());
  const items: Item[] = [
    ...results.map((r, i) => ({
      id: `r${i}`,
      group: r.kind,
      label: r.label,
      sublabel: r.sublabel,
      href: r.href,
    })),
    ...actions
      .filter(filter)
      .map((a) => ({ id: `a${a.key}`, group: "Action", label: a.label, href: a.href })),
    ...destinations
      .filter(filter)
      .map((a) => ({ id: `d${a.key}`, group: "Go to", label: a.label, href: a.href })),
  ];

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && items[active]) {
      e.preventDefault();
      go(items[active]!.href);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cmd-glass hidden items-center gap-2 rounded-[var(--cmd-radius-pill)] px-4 py-2.5 text-sm text-[var(--cmd-fg-muted)] md:inline-flex"
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4" />
        <span>Search or jump…</span>
        <Badge tone="accent">⌘K</Badge>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh] motion-reduce:transition-none"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="cmd-glass-strong w-full max-w-xl overflow-hidden rounded-[var(--cmd-radius-xl)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-[var(--cmd-border)] px-4">
              <Search className="h-4 w-4 text-[var(--cmd-fg-muted)]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Search members, departments, announcements, or jump to…"
                aria-label="Search"
                className="w-full bg-transparent py-3.5 text-sm outline-none"
              />
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox" aria-label="Results">
              {items.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-[var(--cmd-fg-muted)]">
                  {query.trim().length >= 2
                    ? "No results."
                    : "Type to search, or pick a destination."}
                </li>
              ) : null}
              {items.map((item, idx) => (
                <li key={item.id} role="option" aria-selected={idx === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => go(item.href)}
                    className={`flex w-full items-center justify-between gap-2 rounded-[var(--cmd-radius)] px-3 py-2 text-left text-sm ${idx === active ? "bg-[var(--cmd-accent)]/15" : "hover:bg-[var(--cmd-bg-muted)]"}`}
                  >
                    <span className="truncate">{item.label}</span>
                    <span className="shrink-0 text-xs text-[var(--cmd-fg-muted)]">
                      {item.group}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
