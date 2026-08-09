import {
  resolveProvider,
  isAiMode,
  type AiAnswer,
  type AiMode,
  type ComposeInput,
} from "@commandry/ai";
import { prisma } from "@commandry/database";
import { formatKpiValue, type KpiUnit } from "@commandry/insights";
import { authorize, type Action, type Actor } from "@commandry/permissions";
import { ForbiddenError, NotFoundError, createPublicId } from "@commandry/shared";
import { getInsightsBundle, listGoals } from "../insights/service";
import { searchKnowledge } from "../knowledge/service";
import { searchRms } from "../rms/service";

function can(actor: Actor, organizationId: string, action: Action): boolean {
  return authorize({ actor, organizationId, action }).allowed;
}
function requirePerm(actor: Actor, organizationId: string, action: Action): void {
  if (!can(actor, organizationId, action)) throw new ForbiddenError("Not permitted");
}

/**
 * Assemble the AI context in the mandated priority order — deterministic platform
 * intelligence first, then knowledge, then data, then the user's question. Every
 * step is permission-scoped: the AI only ever retrieves what the user may access.
 */
async function assembleContext(
  actor: Actor,
  organizationId: string,
  question: string,
  mode: AiMode,
): Promise<ComposeInput> {
  const input: ComposeInput = { question, mode, knowledge: [] };

  // 1-5: deterministic intelligence (insights → health → goals → kpis → recommendations).
  if (can(actor, organizationId, "insights.view")) {
    try {
      const bundle = await getInsightsBundle({ actor, organizationId });
      const weakestFactors = [...bundle.communityHealth.factors]
        .sort((a, b) => a.score - b.score)
        .slice(0, 4)
        .map((f) => ({ label: f.label, score: f.score, recommendedAction: f.recommendedAction }));
      input.health = {
        overall: bundle.communityHealth.overall,
        severity: bundle.communityHealth.severity,
        trend: bundle.communityHealth.trend,
        weakestFactors,
      };
      input.kpis = bundle.kpis.map((k) => ({
        key: k.key,
        label: k.label,
        value: formatKpiValue(k.unit as KpiUnit, k.current),
        target: formatKpiValue(k.unit as KpiUnit, k.target),
        severity: k.severity,
        trendType: k.trend.type,
        evidence: k.evidence,
      }));
      input.recommendations = bundle.recommendations.map((r) => ({
        text: r.text,
        reason: r.reason,
        severity: r.severity,
      }));
      input.summaryFacts = bundle.executiveSummary.map((l) => l.text);
      if (
        can(actor, organizationId, "goals.manage") ||
        can(actor, organizationId, "insights.view")
      ) {
        const goals = await listGoals({ actor, organizationId });
        input.goals = goals.map((g) => ({
          name: g.name,
          progress: g.progress,
          recommendation: g.recommendation,
        }));
      }
    } catch {
      // insights unavailable — continue with knowledge-only grounding.
    }
  }

  // 6-7: knowledge articles + related (permission + visibility filtered).
  if (can(actor, organizationId, "knowledge.view")) {
    input.knowledge = await searchKnowledge({ actor, organizationId, query: question, limit: 6 });
  }

  // 8-11: operational RMS records (cases/evidence/persons/vehicles/…), permission-scoped.
  if (can(actor, organizationId, "rms.view")) {
    const hits = await searchRms({ actor, organizationId, query: question }).catch(() => []);
    if (hits.length > 0) {
      input.records = hits.slice(0, 6).map((h) => ({
        type: h.type,
        number: h.number,
        title: h.title,
        href: h.href,
        snippet: h.snippet,
      }));
    }
  }

  return input;
}

export type AskResult = { conversationId: string; answer: AiAnswer };

export async function askOrdinex(input: {
  actor: Actor;
  organizationId: string;
  question: string;
  mode?: string;
  conversationId?: string;
}): Promise<AskResult> {
  requirePerm(input.actor, input.organizationId, "ai.use");
  const mode: AiMode = input.mode && isAiMode(input.mode) ? input.mode : "ask";
  const question = input.question.trim();
  if (question.length < 2) throw new NotFoundError("Empty question");

  const context = await assembleContext(input.actor, input.organizationId, question, mode);
  const provider = resolveProvider(process.env as Record<string, string | undefined>);
  const answer = await provider.generate(context);

  // Persist conversation + messages.
  let conversationId = input.conversationId ?? "";
  const existing = conversationId
    ? await prisma.aiConversation.findFirst({
        where: {
          id: conversationId,
          organizationId: input.organizationId,
          userId: input.actor.userId,
        },
      })
    : null;
  if (!existing) {
    const convo = await prisma.aiConversation.create({
      data: {
        publicId: createPublicId("conv"),
        organizationId: input.organizationId,
        userId: input.actor.userId,
        title: question.slice(0, 80),
      },
    });
    conversationId = convo.id;
  } else {
    conversationId = existing.id;
    await prisma.aiConversation.update({
      where: { id: existing.id },
      data: { updatedAt: new Date() },
    });
  }

  await prisma.aiMessage.create({
    data: {
      organizationId: input.organizationId,
      conversationId,
      role: "user",
      content: question,
      mode,
    },
  });
  await prisma.aiMessage.create({
    data: {
      organizationId: input.organizationId,
      conversationId,
      role: "assistant",
      mode,
      intent: answer.intent,
      content: answer.text,
      citations: answer.citations as unknown as object,
      evidence: answer.evidence as unknown as object,
      actions: answer.suggestedActions as unknown as object,
      confidence: answer.confidence,
      usedLLM: answer.usedLLM,
    },
  });

  // Analytics + knowledge-gap detection (no prompt content stored).
  await prisma.aiQueryLog
    .create({
      data: {
        organizationId: input.organizationId,
        userId: input.actor.userId,
        mode,
        intent: answer.intent,
        answered: answer.confidence !== "none",
        confidence: answer.confidence,
        topCitation: answer.citations[0]?.label ?? null,
      },
    })
    .catch(() => undefined);

  return { conversationId, answer };
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export type ConversationView = {
  id: string;
  title: string;
  pinned: boolean;
  shared: boolean;
  updatedAt: string;
};

export async function listConversations(input: {
  actor: Actor;
  organizationId: string;
}): Promise<ConversationView[]> {
  requirePerm(input.actor, input.organizationId, "ai.use");
  const rows = await prisma.aiConversation.findMany({
    where: {
      organizationId: input.organizationId,
      OR: [{ userId: input.actor.userId }, { shared: true }],
    },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    take: 50,
  });
  return rows.map((c) => ({
    id: c.id,
    title: c.title,
    pinned: c.pinned,
    shared: c.shared,
    updatedAt: c.updatedAt.toISOString(),
  }));
}

export type MessageView = {
  role: string;
  content: string;
  mode: string | null;
  intent: string | null;
  confidence: string | null;
  citations: unknown;
  evidence: unknown;
  actions: unknown;
  usedLLM: boolean;
  createdAt: string;
};

export async function getConversation(input: {
  actor: Actor;
  organizationId: string;
  id: string;
}): Promise<{ id: string; title: string; messages: MessageView[] }> {
  requirePerm(input.actor, input.organizationId, "ai.use");
  const convo = await prisma.aiConversation.findFirst({
    where: {
      id: input.id,
      organizationId: input.organizationId,
      OR: [{ userId: input.actor.userId }, { shared: true }],
    },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!convo) throw new NotFoundError("Conversation not found");
  return {
    id: convo.id,
    title: convo.title,
    messages: convo.messages.map((m) => ({
      role: m.role,
      content: m.content,
      mode: m.mode,
      intent: m.intent,
      confidence: m.confidence,
      citations: m.citations,
      evidence: m.evidence,
      actions: m.actions,
      usedLLM: m.usedLLM,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export async function updateConversation(input: {
  actor: Actor;
  organizationId: string;
  id: string;
  pinned?: boolean;
  shared?: boolean;
}): Promise<void> {
  requirePerm(input.actor, input.organizationId, "ai.use");
  const convo = await prisma.aiConversation.findFirst({
    where: { id: input.id, organizationId: input.organizationId, userId: input.actor.userId },
  });
  if (!convo) throw new NotFoundError("Conversation not found");
  await prisma.aiConversation.update({
    where: { id: convo.id },
    data: {
      ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
      ...(input.shared !== undefined ? { shared: input.shared } : {}),
    },
  });
}

export async function deleteConversation(input: {
  actor: Actor;
  organizationId: string;
  id: string;
}): Promise<void> {
  requirePerm(input.actor, input.organizationId, "ai.use");
  const convo = await prisma.aiConversation.findFirst({
    where: { id: input.id, organizationId: input.organizationId, userId: input.actor.userId },
  });
  if (!convo) throw new NotFoundError("Conversation not found");
  await prisma.aiConversation.delete({ where: { id: convo.id } });
}

// ---------------------------------------------------------------------------
// Analytics + knowledge-gap detection
// ---------------------------------------------------------------------------

export type AiAnalytics = {
  totalQuestions: number;
  answered: number;
  answerRate: number;
  knowledgeGaps: number;
  byIntent: Record<string, number>;
  topCitations: { label: string; count: number }[];
  provider: string;
};

export async function getAiAnalytics(input: {
  actor: Actor;
  organizationId: string;
}): Promise<AiAnalytics> {
  requirePerm(input.actor, input.organizationId, "ai.use");
  const logs = await prisma.aiQueryLog.findMany({
    where: { organizationId: input.organizationId },
    take: 2000,
  });
  const byIntent: Record<string, number> = {};
  const citationCounts: Record<string, number> = {};
  let answered = 0;
  let gaps = 0;
  for (const l of logs) {
    byIntent[l.intent] = (byIntent[l.intent] ?? 0) + 1;
    if (l.answered) answered += 1;
    else gaps += 1;
    if (l.topCitation) citationCounts[l.topCitation] = (citationCounts[l.topCitation] ?? 0) + 1;
  }
  return {
    totalQuestions: logs.length,
    answered,
    answerRate: logs.length > 0 ? answered / logs.length : 0,
    knowledgeGaps: gaps,
    byIntent,
    topCitations: Object.entries(citationCounts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    provider: resolveProvider(process.env as Record<string, string | undefined>).name,
  };
}
