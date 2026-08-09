import { recordAuditEvent } from "@commandry/audit";
import { prisma } from "@commandry/database";
import {
  buildExcerpt,
  canTransitionKnowledge,
  citationFor,
  rankArticles,
  slugify,
  type KnowledgeStatus,
  type KnowledgeVisibility,
  type SearchableArticle,
} from "@commandry/knowledge";
import { authorize, type Action, type Actor } from "@commandry/permissions";
import { ForbiddenError, NotFoundError, ValidationError, createPublicId } from "@commandry/shared";
import { createDraft, submitSubmission, listTemplates } from "../workflow/service";

/** Categories are open — organizations may use custom ones. Normalize to a slug. */
function normalizeCategory(category: string): string {
  const c = slugify(category).replace(/-/g, "_");
  if (c.length < 2) throw new ValidationError("Invalid category");
  return c;
}

function can(actor: Actor, organizationId: string, action: Action): boolean {
  return authorize({ actor, organizationId, action }).allowed;
}
function requirePerm(actor: Actor, organizationId: string, action: Action): void {
  if (!can(actor, organizationId, action)) throw new ForbiddenError("Not permitted");
}

type ArticleRow = {
  id: string;
  publicId: string;
  title: string;
  slug: string;
  category: string;
  collection: string | null;
  status: string;
  visibility: string;
  body: string;
  excerpt: string;
  tags: string[];
  keywords: string[];
  relatedIds: string[];
  departmentId: string | null;
  workflowSubmissionId: string | null;
  version: number;
  authorUserId: string | null;
  approverUserId: string | null;
  effectiveAt: Date | null;
  expiresAt: Date | null;
  publishedAt: Date | null;
  updatedAt: Date;
};

/** Can this actor see an article given its visibility? (Managers see everything.) */
function canSeeArticle(
  actor: Actor,
  organizationId: string,
  article: { visibility: string; departmentId: string | null },
): boolean {
  if (can(actor, organizationId, "knowledge.manage")) return true;
  switch (article.visibility as KnowledgeVisibility) {
    case "public":
    case "organization":
      return true;
    case "staff":
      return can(actor, organizationId, "staff:read");
    case "department":
      return article.departmentId ? actor.departmentIds.includes(article.departmentId) : false;
    default:
      return false;
  }
}

export type ArticleView = {
  id: string;
  publicId: string;
  title: string;
  slug: string;
  category: string;
  collection: string | null;
  status: string;
  visibility: string;
  body: string;
  excerpt: string;
  tags: string[];
  keywords: string[];
  relatedIds: string[];
  departmentId: string | null;
  version: number;
  updatedAt: string;
  publishedAt: string | null;
};

function toView(a: ArticleRow): ArticleView {
  return {
    id: a.id,
    publicId: a.publicId,
    title: a.title,
    slug: a.slug,
    category: a.category,
    collection: a.collection,
    status: a.status,
    visibility: a.visibility,
    body: a.body,
    excerpt: a.excerpt,
    tags: a.tags,
    keywords: a.keywords,
    relatedIds: a.relatedIds,
    departmentId: a.departmentId,
    version: a.version,
    updatedAt: a.updatedAt.toISOString(),
    publishedAt: a.publishedAt?.toISOString() ?? null,
  };
}

export async function listArticles(input: {
  actor: Actor;
  organizationId: string;
  category?: string;
  collection?: string;
  status?: string;
  query?: string;
}): Promise<ArticleView[]> {
  requirePerm(input.actor, input.organizationId, "knowledge.view");
  const rows = await prisma.knowledgeArticle.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.category ? { category: input.category } : {}),
      ...(input.collection ? { collection: input.collection } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  const visible = rows.filter(
    (r) =>
      canSeeArticle(input.actor, input.organizationId, r) &&
      (can(input.actor, input.organizationId, "knowledge.manage") || r.status === "published"),
  );
  if (input.query && input.query.trim().length > 0) {
    const ranked = rankArticles(visible as unknown as SearchableArticle[], input.query, 50);
    return ranked.map((r) =>
      toView(visible.find((v) => v.id === r.article.id)! as unknown as ArticleRow),
    );
  }
  return visible.map((r) => toView(r as unknown as ArticleRow));
}

export type KnowledgeSearchHit = {
  id: string;
  title: string;
  version: number;
  href: string;
  category: string;
  excerpt: string;
  score: number;
};

/** Permission + visibility-aware search over PUBLISHED articles. Reused by the AI. */
export async function searchKnowledge(input: {
  actor: Actor;
  organizationId: string;
  query: string;
  limit?: number;
}): Promise<KnowledgeSearchHit[]> {
  requirePerm(input.actor, input.organizationId, "knowledge.view");
  const rows = await prisma.knowledgeArticle.findMany({
    where: { organizationId: input.organizationId, status: "published" },
    take: 500,
  });
  const visible = rows.filter((r) => canSeeArticle(input.actor, input.organizationId, r));
  const ranked = rankArticles(
    visible as unknown as SearchableArticle[],
    input.query,
    input.limit ?? 8,
  );
  return ranked.map((r) => {
    const a = visible.find((v) => v.id === r.article.id)!;
    const cite = citationFor({
      id: a.id,
      title: a.title,
      version: a.version,
      slug: a.slug,
      category: a.category,
    });
    return {
      id: a.id,
      title: a.title,
      version: a.version,
      href: cite.href,
      category: a.category,
      excerpt: a.excerpt || buildExcerpt(a.body),
      score: r.score,
    };
  });
}

export async function getArticle(input: {
  actor: Actor;
  organizationId: string;
  idOrSlug: string;
}): Promise<{
  article: ArticleView;
  versions: { version: number; changeSummary: string | null; createdAt: string }[];
  related: ArticleView[];
  approvalStatus: string | null;
}> {
  requirePerm(input.actor, input.organizationId, "knowledge.view");
  const article = await prisma.knowledgeArticle.findFirst({
    where: {
      organizationId: input.organizationId,
      OR: [{ id: input.idOrSlug }, { slug: input.idOrSlug }],
    },
  });
  if (!article) throw new NotFoundError("Article not found");
  if (!canSeeArticle(input.actor, input.organizationId, article))
    throw new NotFoundError("Article not found");
  if (article.status !== "published" && !can(input.actor, input.organizationId, "knowledge.manage"))
    throw new NotFoundError("Article not found");

  const versions = can(input.actor, input.organizationId, "knowledge.manage")
    ? await prisma.knowledgeVersion.findMany({
        where: { articleId: article.id },
        orderBy: { version: "desc" },
        select: { version: true, changeSummary: true, createdAt: true },
      })
    : [];
  const related = await getRelated({
    actor: input.actor,
    organizationId: input.organizationId,
    articleId: article.id,
  });
  let approvalStatus: string | null = null;
  if (article.workflowSubmissionId) {
    const submission = await prisma.workflowSubmission.findFirst({
      where: { id: article.workflowSubmissionId, organizationId: input.organizationId },
      select: { status: true },
    });
    approvalStatus = submission?.status ?? null;
  }
  return {
    article: toView(article as unknown as ArticleRow),
    versions: versions.map((v) => ({
      version: v.version,
      changeSummary: v.changeSummary,
      createdAt: v.createdAt.toISOString(),
    })),
    related,
    approvalStatus,
  };
}

/** Related articles: explicit relatedIds + inferred by shared tags/category/department (published only). */
export async function getRelated(input: {
  actor: Actor;
  organizationId: string;
  articleId: string;
}): Promise<ArticleView[]> {
  const article = await prisma.knowledgeArticle.findFirst({
    where: { id: input.articleId, organizationId: input.organizationId },
  });
  if (!article) return [];
  const candidates = await prisma.knowledgeArticle.findMany({
    where: {
      organizationId: input.organizationId,
      status: "published",
      id: { not: article.id },
      OR: [
        { id: { in: article.relatedIds } },
        { category: article.category },
        { tags: { hasSome: article.tags } },
        ...(article.departmentId ? [{ departmentId: article.departmentId }] : []),
      ],
    },
    take: 20,
  });
  const visible = candidates.filter((c) => canSeeArticle(input.actor, input.organizationId, c));
  // Explicit relations first.
  const explicit = new Set(article.relatedIds);
  visible.sort((a, b) => Number(explicit.has(b.id)) - Number(explicit.has(a.id)));
  return visible.slice(0, 6).map((v) => toView(v as unknown as ArticleRow));
}

export async function createArticle(input: {
  actor: Actor;
  organizationId: string;
  title: string;
  category: string;
  body: string;
  tags?: string[];
  keywords?: string[];
  visibility?: KnowledgeVisibility;
  departmentId?: string;
  relatedIds?: string[];
  collection?: string;
}): Promise<ArticleView> {
  requirePerm(input.actor, input.organizationId, "knowledge.manage");
  if (input.title.trim().length < 2) throw new ValidationError("Title too short");
  const category = normalizeCategory(input.category);
  const baseSlug = slugify(input.title);
  let slug = baseSlug || `article-${Date.now()}`;
  if (
    await prisma.knowledgeArticle.findFirst({
      where: { organizationId: input.organizationId, slug },
    })
  )
    slug = `${slug}-${Date.now().toString().slice(-5)}`;

  const article = await prisma.knowledgeArticle.create({
    data: {
      publicId: createPublicId("kb"),
      organizationId: input.organizationId,
      title: input.title.trim(),
      slug,
      category,
      collection: input.collection?.trim() || null,
      body: input.body,
      excerpt: buildExcerpt(input.body),
      tags: input.tags ?? [],
      keywords: input.keywords ?? [],
      relatedIds: input.relatedIds ?? [],
      visibility: input.visibility ?? "organization",
      departmentId: input.departmentId ?? null,
      status: "draft",
      version: 1,
      authorUserId: input.actor.userId,
    },
  });
  await prisma.knowledgeVersion.create({
    data: {
      organizationId: input.organizationId,
      articleId: article.id,
      version: 1,
      title: article.title,
      body: article.body,
      changeSummary: "Initial draft",
      status: "draft",
      createdByUserId: input.actor.userId,
    },
  });
  return toView(article as unknown as ArticleRow);
}

export async function updateArticle(input: {
  actor: Actor;
  organizationId: string;
  id: string;
  title?: string;
  body?: string;
  tags?: string[];
  keywords?: string[];
  visibility?: KnowledgeVisibility;
  category?: string;
  collection?: string;
  relatedIds?: string[];
  changeSummary?: string;
}): Promise<ArticleView> {
  requirePerm(input.actor, input.organizationId, "knowledge.manage");
  const existing = await prisma.knowledgeArticle.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!existing) throw new NotFoundError("Article not found");
  const nextBody = input.body ?? existing.body;
  const nextTitle = input.title?.trim() ?? existing.title;
  const nextVersion = existing.version + 1;

  const updated = await prisma.knowledgeArticle.update({
    where: { id: existing.id },
    data: {
      title: nextTitle,
      body: nextBody,
      excerpt: buildExcerpt(nextBody),
      ...(input.tags ? { tags: input.tags } : {}),
      ...(input.keywords ? { keywords: input.keywords } : {}),
      ...(input.visibility ? { visibility: input.visibility } : {}),
      ...(input.category ? { category: normalizeCategory(input.category) } : {}),
      ...(input.collection !== undefined ? { collection: input.collection?.trim() || null } : {}),
      ...(input.relatedIds ? { relatedIds: input.relatedIds } : {}),
      version: nextVersion,
    },
  });
  await prisma.knowledgeVersion.create({
    data: {
      organizationId: input.organizationId,
      articleId: existing.id,
      version: nextVersion,
      title: nextTitle,
      body: nextBody,
      changeSummary: input.changeSummary ?? "Updated",
      status: existing.status,
      createdByUserId: input.actor.userId,
    },
  });
  return toView(updated as unknown as ArticleRow);
}

export async function transitionArticle(input: {
  actor: Actor;
  organizationId: string;
  id: string;
  to: KnowledgeStatus;
  effectiveAt?: Date;
  expiresAt?: Date;
}): Promise<ArticleView> {
  requirePerm(input.actor, input.organizationId, "knowledge.manage");
  if (input.to === "published") requirePerm(input.actor, input.organizationId, "knowledge.publish");
  const existing = await prisma.knowledgeArticle.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!existing) throw new NotFoundError("Article not found");
  if (!canTransitionKnowledge(existing.status as KnowledgeStatus, input.to))
    throw new ValidationError(`Cannot move from ${existing.status} to ${input.to}`);
  // If this article was routed through the Workflow Platform for approval, it may
  // only be published once that workflow submission is approved (COMPLETED).
  if (input.to === "published" && existing.workflowSubmissionId) {
    const submission = await prisma.workflowSubmission.findFirst({
      where: { id: existing.workflowSubmissionId, organizationId: input.organizationId },
    });
    if (submission && submission.status !== "COMPLETED") {
      throw new ValidationError(
        "This document is awaiting approval in the Workflow Platform and cannot be published yet.",
      );
    }
  }
  const updated = await prisma.knowledgeArticle.update({
    where: { id: existing.id },
    data: {
      status: input.to,
      ...(input.to === "published"
        ? { publishedAt: new Date(), approverUserId: input.actor.userId }
        : {}),
      ...(input.effectiveAt ? { effectiveAt: input.effectiveAt } : {}),
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    },
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "document:publish",
    resourceType: "knowledge_article",
    resourceId: existing.id,
    source: "WEB",
    metadata: { to: input.to },
  }).catch(() => undefined);
  return toView(updated as unknown as ArticleRow);
}

export async function rollbackArticle(input: {
  actor: Actor;
  organizationId: string;
  id: string;
  toVersion: number;
}): Promise<ArticleView> {
  requirePerm(input.actor, input.organizationId, "knowledge.manage");
  const existing = await prisma.knowledgeArticle.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!existing) throw new NotFoundError("Article not found");
  const target = await prisma.knowledgeVersion.findFirst({
    where: { articleId: existing.id, version: input.toVersion },
  });
  if (!target) throw new NotFoundError("Version not found");
  return updateArticle({
    actor: input.actor,
    organizationId: input.organizationId,
    id: existing.id,
    title: target.title,
    body: target.body,
    changeSummary: `Rolled back to v${input.toVersion}`,
  });
}

export async function deleteArticle(input: {
  actor: Actor;
  organizationId: string;
  id: string;
}): Promise<void> {
  requirePerm(input.actor, input.organizationId, "knowledge.manage");
  const existing = await prisma.knowledgeArticle.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!existing) throw new NotFoundError("Article not found");
  await prisma.knowledgeArticle.delete({ where: { id: existing.id } });
}

/**
 * Route a document through the Workflow Platform for approval. Reuses the
 * built-in "Document Approval" workflow — the Knowledge module never
 * re-implements approval/review logic. Publishing is then gated on that workflow
 * submission being approved (see transitionArticle).
 */
export async function submitArticleForApproval(input: {
  actor: Actor;
  organizationId: string;
  id: string;
  changeSummary?: string;
}): Promise<{ submissionId: string }> {
  requirePerm(input.actor, input.organizationId, "knowledge.manage");
  const existing = await prisma.knowledgeArticle.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!existing) throw new NotFoundError("Article not found");
  const templates = await listTemplates({
    actor: input.actor,
    organizationId: input.organizationId,
    category: "document",
  });
  const template = templates.find((t) => t.category === "document");
  if (!template) throw new ValidationError("Document approval workflow is unavailable");
  const draft = await createDraft({
    actor: input.actor,
    organizationId: input.organizationId,
    templateId: template.id,
  });
  await submitSubmission({
    actor: input.actor,
    organizationId: input.organizationId,
    submissionId: draft.id,
    data: { document: existing.title, changeSummary: input.changeSummary ?? "" },
  });
  await prisma.knowledgeArticle.update({
    where: { id: existing.id },
    data: { status: "review", workflowSubmissionId: draft.id },
  });
  return { submissionId: draft.id };
}

export type VersionCompare = {
  a: { version: number; title: string; body: string };
  b: { version: number; title: string; body: string };
  diff: { line: string; change: "added" | "removed" | "same" }[];
};

/** Deterministic line-level comparison between two article versions. */
export async function compareVersions(input: {
  actor: Actor;
  organizationId: string;
  id: string;
  versionA: number;
  versionB: number;
}): Promise<VersionCompare> {
  requirePerm(input.actor, input.organizationId, "knowledge.view");
  const [va, vb] = await Promise.all([
    prisma.knowledgeVersion.findFirst({
      where: { articleId: input.id, organizationId: input.organizationId, version: input.versionA },
    }),
    prisma.knowledgeVersion.findFirst({
      where: { articleId: input.id, organizationId: input.organizationId, version: input.versionB },
    }),
  ]);
  if (!va || !vb) throw new NotFoundError("Version not found");
  const linesB = vb.body.split("\n");
  const setA = new Set(va.body.split("\n").map((l) => l.trim()));
  const setB = new Set(linesB.map((l) => l.trim()));
  const diff: VersionCompare["diff"] = [];
  for (const line of va.body.split("\n"))
    diff.push({ line, change: setB.has(line.trim()) ? "same" : "removed" });
  for (const line of linesB) if (!setA.has(line.trim())) diff.push({ line, change: "added" });
  return {
    a: { version: va.version, title: va.title, body: va.body },
    b: { version: vb.version, title: vb.title, body: vb.body },
    diff,
  };
}

/**
 * Contextual knowledge surfacing — given a context (e.g. a patrol shift's title/
 * type/department) return related published SOPs/policies/guides, so relevant
 * documents surface automatically without manual linking.
 */
export async function getContextualKnowledge(input: {
  actor: Actor;
  organizationId: string;
  keywords: string;
  limit?: number;
}): Promise<KnowledgeSearchHit[]> {
  if (input.keywords.trim().length === 0) return [];
  return searchKnowledge({
    actor: input.actor,
    organizationId: input.organizationId,
    query: input.keywords,
    limit: input.limit ?? 5,
  });
}

/** Distinct collections (folders) the actor can see. */
export async function listCollections(input: {
  actor: Actor;
  organizationId: string;
}): Promise<{ name: string; count: number }[]> {
  requirePerm(input.actor, input.organizationId, "knowledge.view");
  const rows = await prisma.knowledgeArticle.findMany({
    where: { organizationId: input.organizationId, collection: { not: null } },
    select: { collection: true, visibility: true, departmentId: true },
  });
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!r.collection || !canSeeArticle(input.actor, input.organizationId, r)) continue;
    counts.set(r.collection, (counts.get(r.collection) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
