import { recordAuditEvent } from "@commandry/audit";
import { prisma } from "@commandry/database";
import {
  buildExcerpt,
  canTransitionKnowledge,
  citationFor,
  isKnowledgeCategory,
  rankArticles,
  slugify,
  type KnowledgeStatus,
  type KnowledgeVisibility,
  type SearchableArticle,
} from "@commandry/knowledge";
import { authorize, type Action, type Actor } from "@commandry/permissions";
import { ForbiddenError, NotFoundError, ValidationError, createPublicId } from "@commandry/shared";

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
  status: string;
  visibility: string;
  body: string;
  excerpt: string;
  tags: string[];
  keywords: string[];
  relatedIds: string[];
  departmentId: string | null;
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
  status?: string;
  query?: string;
}): Promise<ArticleView[]> {
  requirePerm(input.actor, input.organizationId, "knowledge.view");
  const rows = await prisma.knowledgeArticle.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.category ? { category: input.category } : {}),
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
  return {
    article: toView(article as unknown as ArticleRow),
    versions: versions.map((v) => ({
      version: v.version,
      changeSummary: v.changeSummary,
      createdAt: v.createdAt.toISOString(),
    })),
    related,
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
}): Promise<ArticleView> {
  requirePerm(input.actor, input.organizationId, "knowledge.manage");
  if (input.title.trim().length < 2) throw new ValidationError("Title too short");
  if (!isKnowledgeCategory(input.category)) throw new ValidationError("Unknown category");
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
      category: input.category,
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
      ...(input.category && isKnowledgeCategory(input.category)
        ? { category: input.category }
        : {}),
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
