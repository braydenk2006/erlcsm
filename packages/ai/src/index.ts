/**
 * Ordinex AI — domain. The AI is an intelligent interface over deterministic
 * platform intelligence; it never replaces it. This module defines modes, prompt
 * orchestration, the provider abstraction, and a **grounded** deterministic
 * composer that answers strictly from retrieved evidence with citations. When a
 * language-model provider is configured it composes the same evidence + prompt;
 * the grounding, citations, and permission-scoped retrieval never change.
 */

export const AI_MODES = [
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
export type AiMode = (typeof AI_MODES)[number];

export function isAiMode(value: string): value is AiMode {
  return (AI_MODES as readonly string[]).includes(value);
}

export type Confidence = "high" | "medium" | "low" | "none";

export type Citation = {
  kind:
    | "knowledge"
    | "insights"
    | "health"
    | "kpi"
    | "goal"
    | "recommendation"
    | "workflow"
    | "website"
    | "record";
  label: string;
  href?: string;
};

export type EvidencePiece = { kind: Citation["kind"]; label: string; detail: string };
export type SuggestedAction = { label: string; href: string };

export type KnowledgeHit = {
  id: string;
  title: string;
  version: number;
  href: string;
  category: string;
  excerpt: string;
  score: number;
};

/** Normalized, permission-scoped context the retrieval pipeline assembles. */
export type ComposeInput = {
  question: string;
  mode: AiMode;
  health?: {
    overall: number;
    severity: string;
    trend: string;
    weakestFactors: { label: string; score: number; recommendedAction: string }[];
  };
  kpis?: {
    key: string;
    label: string;
    value: string;
    target: string;
    severity: string;
    trendType: string;
    evidence: string;
  }[];
  recommendations?: { text: string; reason: string; severity: string }[];
  goals?: { name: string; progress: number; recommendation: string }[];
  knowledge: KnowledgeHit[];
  /** RMS operational records surfaced for the question (permission-scoped). */
  records?: { type: string; number: string; title: string; href: string; snippet: string }[];
  summaryFacts?: string[];
};

export type AiAnswer = {
  text: string;
  mode: AiMode;
  intent: AiIntent;
  citations: Citation[];
  evidence: EvidencePiece[];
  confidence: Confidence;
  suggestedActions: SuggestedAction[];
  isDraft: boolean;
  usedLLM: boolean;
};

// ---------------------------------------------------------------------------
// Intent classification (deterministic)
// ---------------------------------------------------------------------------

export const AI_INTENTS = [
  "health_explain",
  "attendance_explain",
  "kpi_explain",
  "recommendation_explain",
  "knowledge_search",
  "draft",
  "summarize",
  "generic",
] as const;
export type AiIntent = (typeof AI_INTENTS)[number];

const has = (q: string, ...terms: string[]) => terms.some((t) => q.includes(t));

export function classifyIntent(question: string, mode: AiMode): AiIntent {
  const q = question.toLowerCase();
  if (mode === "draft" || mode === "generate") return "draft";
  if (mode === "summarize") return "summarize";
  if (mode === "recommend") return "recommendation_explain";
  if (mode === "search") return "knowledge_search";

  if (has(q, "community health", "health score", "why is health", "health low"))
    return "health_explain";
  if (has(q, "attendance")) return "attendance_explain";
  if (has(q, "recommend", "what should i do", "next step")) return "recommendation_explain";
  if (has(q, "draft", "write me", "compose", "generate an announce", "announcement for"))
    return "draft";
  if (has(q, "kpi", "metric", "success rate", "completion rate")) return "kpi_explain";
  if (
    has(
      q,
      "find",
      "search",
      "policy",
      "sop",
      "procedure",
      "guide",
      "requirement",
      "handbook",
      "manual",
      "how do",
      "where is",
      "what is the",
    )
  )
    return "knowledge_search";
  if (has(q, "summarize", "summary", "brief")) return "summarize";
  return "generic";
}

// ---------------------------------------------------------------------------
// Prompt orchestration (per-mode; used by language-model providers)
// ---------------------------------------------------------------------------

const GROUNDING_RULES =
  "You are Ordinex AI. Use ONLY the provided platform evidence and knowledge articles. " +
  "Never invent policies, statistics, scores, users, or documents. Cite every fact using the provided citations. " +
  "If the evidence does not answer the question, say so plainly and offer to draft a document. " +
  "Clearly label anything you draft as an AI-generated draft.";

const MODE_INSTRUCTIONS: Record<AiMode, string> = {
  ask: "Answer the question directly from the evidence, then list the sources you used.",
  explain:
    "Explain the result using the deterministic factors and recommendations in the evidence.",
  summarize:
    "Summarize the provided facts concisely. Do not add facts not present in the evidence.",
  draft:
    "Produce a clearly-labeled draft. Use placeholders where specific facts are unknown; never fabricate figures.",
  review:
    "Review the item against the cited policies/knowledge; note where it complies or conflicts, citing sources.",
  search: "Return the most relevant knowledge articles with a one-line reason each, as citations.",
  recommend:
    "Present the deterministic recommendations verbatim with their reasons; do not invent new ones.",
  analyze: "Analyze using only the provided KPIs, trends, and insights; cite each figure.",
  translate: "Translate the provided text faithfully without adding content.",
  compare: "Compare the cited items point by point using only their content.",
  generate: "Generate the requested artifact as a labeled draft grounded in the provided evidence.",
};

export function buildPrompt(mode: AiMode, input: ComposeInput): { system: string; user: string } {
  const evidenceBlock = renderEvidenceForPrompt(input);
  return {
    system: `${GROUNDING_RULES}\n\nTask mode: ${mode}. ${MODE_INSTRUCTIONS[mode]}`,
    user: `Question: ${input.question}\n\n=== Retrieved platform evidence (in priority order) ===\n${evidenceBlock}`,
  };
}

function renderEvidenceForPrompt(input: ComposeInput): string {
  const parts: string[] = [];
  if (input.health)
    parts.push(
      `[Community Health] ${input.health.overall} (${input.health.severity}, ${input.health.trend}). Weakest: ${input.health.weakestFactors.map((f) => `${f.label} ${f.score}`).join(", ")}`,
    );
  if (input.kpis?.length)
    parts.push(
      `[KPIs] ${input.kpis.map((k) => `${k.label}=${k.value} (target ${k.target}, ${k.trendType})`).join("; ")}`,
    );
  if (input.recommendations?.length)
    parts.push(
      `[Recommendations] ${input.recommendations.map((r) => `${r.text} — because ${r.reason}`).join(" | ")}`,
    );
  if (input.goals?.length)
    parts.push(
      `[Goals] ${input.goals.map((g) => `${g.name}: ${Math.round(g.progress * 100)}%`).join("; ")}`,
    );
  if (input.knowledge.length)
    parts.push(
      `[Knowledge] ${input.knowledge.map((k) => `${k.title} v${k.version}: ${k.excerpt}`).join("\n")}`,
    );
  if (input.records?.length)
    parts.push(
      `[Records] ${input.records.map((r) => `${r.number} ${r.title} (${r.type})`).join("; ")}`,
    );
  if (input.summaryFacts?.length) parts.push(`[Facts] ${input.summaryFacts.join("; ")}`);
  return parts.length ? parts.join("\n") : "(no evidence retrieved)";
}

// ---------------------------------------------------------------------------
// Grounded deterministic composer (default provider)
// ---------------------------------------------------------------------------

const KNOWLEDGE_GAP_ACTION: SuggestedAction = {
  label: "Draft a new article",
  href: "/app/knowledge?new=1",
};

export function composeAnswer(input: ComposeInput): AiAnswer {
  const intent = classifyIntent(input.question, input.mode);
  const base = { mode: input.mode, intent, isDraft: false, usedLLM: false } as const;

  switch (intent) {
    case "health_explain": {
      if (!input.health)
        return noEvidence(input, "I don't have a current Community Health calculation to explain.");
      const weak = input.health.weakestFactors.slice(0, 3);
      const text =
        `Community Health is ${input.health.overall} (${input.health.severity}, trend ${input.health.trend}). ` +
        (weak.length
          ? `The factors weighing it down most are: ${weak.map((f) => `${f.label} (${f.score}/100 — ${f.recommendedAction})`).join("; ")}.`
          : "All factors are healthy.");
      return {
        ...base,
        text,
        citations: [
          { kind: "health", label: "Community Health", href: "/app/insights" },
          { kind: "insights", label: "Insights Engine", href: "/app/insights" },
        ],
        evidence: weak.map((f) => ({
          kind: "health" as const,
          label: f.label,
          detail: `Score ${f.score}/100`,
        })),
        confidence: "high",
        suggestedActions: [{ label: "Open Insights", href: "/app/insights" }],
      };
    }
    case "attendance_explain":
    case "kpi_explain": {
      const relevant = (input.kpis ?? [])
        .filter((k) => (intent === "attendance_explain" ? k.key === "attendance_rate" : true))
        .slice(0, 6);
      if (relevant.length === 0)
        return noEvidence(input, "I don't have the requested metrics available.");
      const text = relevant
        .map(
          (k) =>
            `${k.label} is ${k.value} (target ${k.target}, trend ${k.trendType}). ${k.evidence}`,
        )
        .join(" ");
      return {
        ...base,
        text,
        citations: [{ kind: "kpi", label: "KPI Engine", href: "/app/insights" }],
        evidence: relevant.map((k) => ({
          kind: "kpi" as const,
          label: k.label,
          detail: `${k.value} vs target ${k.target}`,
        })),
        confidence: "high",
        suggestedActions: [{ label: "Open Insights", href: "/app/insights" }],
      };
    }
    case "recommendation_explain": {
      const recs = input.recommendations ?? [];
      if (recs.length === 0)
        return {
          ...base,
          text: "There are no outstanding recommendations — all tracked metrics are on target.",
          citations: [{ kind: "insights", label: "Insights Engine", href: "/app/insights" }],
          evidence: [],
          confidence: "high",
          suggestedActions: [],
        };
      const text = recs.map((r, i) => `${i + 1}. ${r.text} (because ${r.reason})`).join("\n");
      return {
        ...base,
        text,
        citations: [
          { kind: "recommendation", label: "Recommendation Engine", href: "/app/insights" },
        ],
        evidence: recs.map((r) => ({
          kind: "recommendation" as const,
          label: r.text,
          detail: r.reason,
        })),
        confidence: "high",
        suggestedActions: [{ label: "Open Insights", href: "/app/insights" }],
      };
    }
    case "knowledge_search": {
      if (input.knowledge.length === 0) {
        // No knowledge article — but operational RMS records may answer it (cited).
        const records = input.records ?? [];
        if (records.length > 0) {
          const top = records[0]!;
          return {
            ...base,
            text: `No published document matches, but ${records.length} operational record(s) do. Top match: ${top.number} — ${top.title} (${top.type.replace(/_/g, " ")}).`,
            citations: records.slice(0, 5).map((r) => ({
              kind: "record" as const,
              label: `${r.number} — ${r.title}`,
              href: r.href,
            })),
            evidence: records
              .slice(0, 5)
              .map((r) => ({ kind: "record" as const, label: r.number, detail: r.title })),
            confidence: "high",
            suggestedActions: [{ label: `Open ${top.number}`, href: top.href }],
          };
        }
        return {
          ...base,
          text: "No published document currently answers this question. I won't guess. Would you like to draft a new article?",
          citations: [],
          evidence: [],
          confidence: "none",
          suggestedActions: [KNOWLEDGE_GAP_ACTION],
        };
      }
      const top = input.knowledge[0]!;
      const text = `According to ${top.title} v${top.version}: ${top.excerpt}`;
      return {
        ...base,
        text,
        citations: input.knowledge.slice(0, 5).map((k) => ({
          kind: "knowledge" as const,
          label: `${k.title} v${k.version}`,
          href: k.href,
        })),
        evidence: input.knowledge
          .slice(0, 5)
          .map((k) => ({ kind: "knowledge" as const, label: k.title, detail: k.excerpt })),
        confidence: input.knowledge.length >= 1 ? "high" : "medium",
        suggestedActions: [{ label: `Open ${top.title}`, href: top.href }],
      };
    }
    case "draft": {
      const kn = input.knowledge[0];
      const text =
        `AI-generated draft (review before publishing):\n\n` +
        (input.question.toLowerCase().includes("announce")
          ? `Subject: [Announcement title]\n\nTeam, [key message here]. [Details/placeholder]. Please [call to action].\n\n— [Your name]`
          : `# [Document title]\n\n## Purpose\n[Describe the purpose.]\n\n## Procedure\n1. [Step one]\n2. [Step two]\n\n## Notes\n[Any additional notes.]`) +
        (kn ? `\n\n(Referenced: ${kn.title} v${kn.version} for tone/structure.)` : "");
      return {
        ...base,
        text,
        isDraft: true,
        citations: kn
          ? [{ kind: "knowledge", label: `${kn.title} v${kn.version}`, href: kn.href }]
          : [],
        evidence: [],
        confidence: "medium",
        suggestedActions: [{ label: "Open Knowledge", href: "/app/knowledge" }],
      };
    }
    case "summarize": {
      const facts = input.summaryFacts ?? [];
      if (facts.length === 0 && !input.health)
        return noEvidence(input, "There is nothing to summarize from the available evidence.");
      const text = [
        input.health ? `Community Health ${input.health.overall} (${input.health.severity}).` : "",
        ...facts,
      ]
        .filter(Boolean)
        .join(" ");
      return {
        ...base,
        text,
        citations: [{ kind: "insights", label: "Insights Engine", href: "/app/insights" }],
        evidence: facts.map((f) => ({ kind: "insights" as const, label: "Fact", detail: f })),
        confidence: facts.length || input.health ? "high" : "low",
        suggestedActions: [],
      };
    }
    default: {
      if (input.knowledge.length > 0) return composeAnswer({ ...input, mode: "search" });
      if (input.health || (input.kpis?.length ?? 0) > 0)
        return composeAnswer({ ...input, mode: "summarize" });
      return noEvidence(
        input,
        "I don't have platform evidence or a published document that answers that. I won't guess.",
      );
    }
  }
}

function noEvidence(input: ComposeInput, text: string): AiAnswer {
  return {
    text,
    mode: input.mode,
    intent: classifyIntent(input.question, input.mode),
    citations: [],
    evidence: [],
    confidence: "none",
    suggestedActions: [KNOWLEDGE_GAP_ACTION],
    isDraft: false,
    usedLLM: false,
  };
}

// ---------------------------------------------------------------------------
// Provider abstraction (vendor-agnostic)
// ---------------------------------------------------------------------------

export type AiProvider = {
  name: string;
  usesLLM: boolean;
  generate: (input: ComposeInput) => Promise<AiAnswer>;
};

/** Default provider: fully deterministic, grounded, no external calls. */
export function createGroundedProvider(): AiProvider {
  return {
    name: "grounded",
    usesLLM: false,
    generate: async (input) => composeAnswer(input),
  };
}

export type LiveProviderConfig = {
  vendor: "openai" | "anthropic" | "google";
  apiKey: string;
  model: string;
  endpoint?: string;
};

/**
 * Language-model provider. It grounds identically: it composes the deterministic
 * answer (citations, evidence, confidence, actions) and only asks the model to
 * rewrite the prose from the SAME evidence + per-mode prompt, falling back to the
 * grounded text on any error. Vendor is pluggable — nothing is hardcoded.
 */
export function createLiveProvider(
  config: LiveProviderConfig,
  fetchImpl: typeof fetch = fetch,
): AiProvider {
  return {
    name: `llm:${config.vendor}`,
    usesLLM: true,
    generate: async (input) => {
      const grounded = composeAnswer(input);
      try {
        const { system, user } = buildPrompt(input.mode, input);
        const prose = await callVendor(config, system, user, fetchImpl);
        return prose ? { ...grounded, text: prose, usedLLM: true } : grounded;
      } catch {
        return grounded; // safety: never fail open into fabrication
      }
    },
  };
}

async function callVendor(
  config: LiveProviderConfig,
  system: string,
  user: string,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  if (config.vendor === "openai") {
    const res = await fetchImpl(config.endpoint ?? "https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content ?? null;
  }
  // Other vendors are wired the same way; omitted until configured.
  return null;
}

/** Resolve a provider from environment (live if a key is present, else grounded). */
export function resolveProvider(env: Record<string, string | undefined> = {}): AiProvider {
  if (env.OPENAI_API_KEY)
    return createLiveProvider({
      vendor: "openai",
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL ?? "gpt-4o-mini",
    });
  return createGroundedProvider();
}
