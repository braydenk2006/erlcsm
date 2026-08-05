"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@commandry/ui";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", {
        headers: { "content-type": "application/json" },
      });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.notifications ?? []);
      setUnread(json.unread ?? 0);
    } catch {
      // Non-fatal: the bell degrades to its last known state.
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 45_000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markOne = async (id: string) => {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
    }).catch(() => undefined);
    void load();
  };

  const markAll = async () => {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
    }).catch(() => undefined);
    void load();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)]"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--cmd-accent)] px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="cmd-glass-strong absolute right-0 z-40 mt-2 w-80 rounded-[var(--cmd-radius-lg)] p-2 shadow-xl">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-sm font-medium">Notifications</span>
            {unread > 0 ? (
              <button type="button" onClick={markAll} className="text-xs text-[var(--cmd-accent)]">
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-[var(--cmd-fg-muted)]">
                You&apos;re all caught up.
              </p>
            ) : (
              items.map((n) => {
                const content = (
                  <div
                    className={cn(
                      "rounded-[var(--cmd-radius)] px-2 py-2 text-sm",
                      n.readAt ? "opacity-70" : "bg-[var(--cmd-bg-muted)]/60",
                    )}
                  >
                    <p className="font-medium">{n.title}</p>
                    {n.body ? <p className="text-xs text-[var(--cmd-fg-muted)]">{n.body}</p> : null}
                  </div>
                );
                return (
                  <div key={n.id} onClick={() => void markOne(n.id)}>
                    {n.linkUrl ? (
                      <Link href={n.linkUrl} onClick={() => setOpen(false)}>
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
