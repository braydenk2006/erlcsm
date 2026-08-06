"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { Badge, Button } from "@commandry/ui";

type Citation = { kind: string; label: string; href?: string };
type Evidence = { kind: string; label: string; detail: string };
type ActionRef = { label: string; href: string };
type Answer = {
  text: string;
  mode: string;
  intent: string;
  citations: Citation[];
  evidence: Evidence[];
  confidence: string;
  suggestedActions: ActionRef[];
  isDraft: boolean;
  usedLLM: boolean;
};
type Turn = { question: string; answer: Answer };

const MODES = [
  "ask",
  "explain",
  "summarize",
  "draft",
  "review",
  "search",
  "recommend",
  "analyze",
  "translate",
  "compare",
  "generate",
] as const;
type Conversation = {
  id: string;
  title: string;
  pinned: boolean;
  shared: boolean;
  updatedAt: string;
};
const EXAMPLES = [
  "Why is Community Health low?",
  "Find the pursuit policy",
  "What should I do next?",
  "Explain Sergeant requirements",
  "Draft an announcement about training",
  "Show attendance",
];

const confTone: Record<string, "success" | "warning" | "danger" | "accent" | "neutral"> = {
  high: "success",
  medium: "accent",
  low: "warning",
  none: "danger",
};
const kindTone: Record<string, "success" | "accent" | "neutral"> = {
  knowledge: "accent",
  health: "success",
  insights: "success",
  kpi: "success",
  recommendation: "accent",
  goal: "accent",
  workflow: "neutral",
  website: "neutral",
};

export function AssistantView({ initialQuestion }: { initialQuestion?: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState(initialQuestion ?? "");
  const [mode, setMode] = useState<(typeof MODES)[number]>("ask");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const submittedInitial = useRef(false);

  const loadConversations = async () => {
    const res = await fetch("/api/ai/conversations");
    if (res.ok) setConversations((await res.json()).conversations ?? []);
  };
  useEffect(() => {
    void loadConversations();
  }, []);

  const resume = async (id: string) => {
    const res = await fetch(`/api/ai/conversations/${id}`);
    if (!res.ok) return;
    const convo = await res.json();
    const loaded: Turn[] = [];
    let pendingQ = "";
    for (const m of convo.messages as {
      role: string;
      content: string;
      citations: Citation[];
      evidence: Evidence[];
      actions: ActionRef[];
      confidence: string;
      mode: string;
      intent: string;
      usedLLM: boolean;
    }[]) {
      if (m.role === "user") pendingQ = m.content;
      else
        loaded.push({
          question: pendingQ,
          answer: {
            text: m.content,
            mode: m.mode,
            intent: m.intent,
            citations: m.citations,
            evidence: m.evidence,
            confidence: m.confidence,
            suggestedActions: m.actions,
            isDraft: false,
            usedLLM: m.usedLLM,
          },
        });
    }
    setTurns(loaded);
    setConversationId(id);
  };

  const ask = async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2 || busy) return;
    setBusy(true);
    setError(null);
    setQuestion("");
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: trimmed, mode, conversationId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Request failed");
      setConversationId(json.conversationId);
      setTurns((t) => [...t, { question: trimmed, answer: json.answer }]);
      void loadConversations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (initialQuestion && !submittedInitial.current) {
      submittedInitial.current = true;
      void ask(initialQuestion);
    }
  }, [initialQuestion]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-[var(--cmd-fg-muted)]">
            <Sparkles className="h-3.5 w-3.5" /> Ask Ordinex
          </p>
          <h1 className="font-[family-name:var(--cmd-font-display)] text-3xl">AI Assistant</h1>
          <p className="mt-1 text-sm text-[var(--cmd-fg-muted)]">
            Grounded in deterministic platform intelligence and your published knowledge — every
            factual answer is cited, and it never invents data.
          </p>
        </div>
        {turns.length > 0 ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setTurns([]);
              setConversationId(undefined);
            }}
          >
            New chat
          </Button>
        ) : null}
      </header>

      {conversations.length > 0 ? (
        <details className="cmd-glass rounded-[var(--cmd-radius-xl)] p-3">
          <summary className="cursor-pointer text-sm text-[var(--cmd-fg-muted)]">
            Recent conversations ({conversations.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {conversations.slice(0, 8).map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => resume(c.id)}
                  className={`w-full truncate rounded-[var(--cmd-radius)] px-2.5 py-1.5 text-left text-sm hover:bg-[var(--cmd-bg-muted)] ${conversationId === c.id ? "bg-[var(--cmd-bg-muted)]" : ""}`}
                >
                  {c.pinned ? "📌 " : ""}
                  {c.shared ? "· shared · " : ""}
                  {c.title}
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {turns.length === 0 ? (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => ask(ex)}
              className="cmd-glass rounded-[var(--cmd-radius-pill)] px-3 py-1.5 text-sm hover:bg-[var(--cmd-bg-muted)]"
            >
              {ex}
            </button>
          ))}
        </div>
      ) : null}

      <div className="space-y-4">
        {turns.map((turn, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-[var(--cmd-radius-xl)] bg-[var(--cmd-accent)]/15 px-3.5 py-2 text-sm">
                {turn.question}
              </p>
            </div>
            <div className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone={confTone[turn.answer.confidence] ?? "neutral"}>
                  {turn.answer.confidence === "none"
                    ? "no evidence"
                    : `${turn.answer.confidence} confidence`}
                </Badge>
                {turn.answer.isDraft ? <Badge tone="warning">AI draft</Badge> : null}
                <span className="text-xs text-[var(--cmd-fg-muted)]">
                  {turn.answer.usedLLM ? "language model" : "grounded"} ·{" "}
                  {turn.answer.intent.replace(/_/g, " ")}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{turn.answer.text}</p>

              {turn.answer.citations.length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs uppercase tracking-wide text-[var(--cmd-fg-muted)]">
                    Sources
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {turn.answer.citations.map((c, j) => (
                      <li key={j}>
                        {c.href ? (
                          <Link
                            href={c.href}
                            className="inline-flex items-center gap-1 rounded-[var(--cmd-radius-pill)] bg-[var(--cmd-bg-muted)] px-2.5 py-1 text-xs hover:underline"
                          >
                            <Badge tone={kindTone[c.kind] ?? "neutral"}>{c.kind}</Badge>
                            {c.label}
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-[var(--cmd-radius-pill)] bg-[var(--cmd-bg-muted)] px-2.5 py-1 text-xs">
                            <Badge tone={kindTone[c.kind] ?? "neutral"}>{c.kind}</Badge>
                            {c.label}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {turn.answer.suggestedActions.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {turn.answer.suggestedActions.map((a, j) => (
                    <Button key={j} size="sm" variant="outline" asChild>
                      <Link href={a.href}>{a.label}</Link>
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {busy ? (
          <div className="cmd-glass rounded-[var(--cmd-radius-xl)] p-4 text-sm text-[var(--cmd-fg-muted)]">
            Retrieving platform evidence…
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      {error ? (
        <div className="rounded-[var(--cmd-radius)] border border-[var(--cmd-danger)]/40 bg-[var(--cmd-danger)]/10 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
        className="cmd-glass-strong sticky bottom-4 flex items-center gap-2 rounded-[var(--cmd-radius-xl)] p-2"
      >
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as (typeof MODES)[number])}
          aria-label="Mode"
          className="h-10 rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-muted)] px-2 text-sm"
        >
          {MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask Ordinex anything about your community…"
          aria-label="Ask Ordinex"
          className="h-10 flex-1 rounded-[var(--cmd-radius)] bg-transparent px-2 text-sm outline-none"
        />
        <Button type="submit" size="sm" disabled={busy}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
