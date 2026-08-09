/**
 * Knowledge Platform — pure domain. Lifecycle, visibility, categories, and a
 * deterministic search-ranking function (no external search engine). The AI
 * Platform reuses `scoreArticle`/`rankArticles` so there is exactly one search.
 */

export const KNOWLEDGE_STATUSES = [
  "draft",
  "review",
  "approved",
  "published",
  "archived",
  "superseded",
  "expired",
] as const;
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

const TRANSITIONS: Record<KnowledgeStatus, KnowledgeStatus[]> = {
  draft: ["review", "published", "archived"],
  review: ["approved", "draft", "archived"],
  approved: ["published", "draft", "archived"],
  published: ["archived", "superseded", "expired", "draft"],
  archived: ["draft"],
  superseded: [],
  expired: ["draft", "published"],
};

export function canTransitionKnowledge(from: KnowledgeStatus, to: KnowledgeStatus): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export const VISIBILITIES = ["organization", "department", "staff", "public"] as const;
export type KnowledgeVisibility = (typeof VISIBILITIES)[number];

export const KNOWLEDGE_CATEGORIES = [
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
] as const;
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export function isKnowledgeCategory(value: string): value is KnowledgeCategory {
  return (KNOWLEDGE_CATEGORIES as readonly string[]).includes(value);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// ---------------------------------------------------------------------------
// Deterministic search ranking (keyword + tag + category; term-frequency style)
// ---------------------------------------------------------------------------

export type SearchableArticle = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  keywords: string[];
  body: string;
  departmentId?: string | null;
};

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "to",
  "is",
  "are",
  "for",
  "and",
  "or",
  "in",
  "on",
  "how",
  "do",
  "i",
  "what",
  "why",
  "where",
  "who",
  "my",
  "our",
]);

// Category-descriptor words appear in most titles ("policy", "sop", …). They are
// too generic to establish relevance alone, so a hit must also match a specific
// term — otherwise "boat patrol policy" would wrongly surface any policy.
const GENERIC_TERMS = new Set([
  "policy",
  "policies",
  "sop",
  "sops",
  "procedure",
  "procedures",
  "guide",
  "guides",
  "manual",
  "manuals",
  "handbook",
  "handbooks",
  "requirement",
  "requirements",
  "article",
  "articles",
  "faq",
  "rank",
  "document",
  "documents",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Score an article against a query. Weighted: title match >> keyword/tag match >
 * category match > body frequency. Deterministic and explainable — the same
 * scorer backs the AI retrieval step.
 */
export function scoreArticle(article: SearchableArticle, query: string): number {
  const terms = tokenize(query);
  if (terms.length === 0) return 0;
  const title = article.title.toLowerCase();
  const tagSet = new Set(article.tags.map((t) => t.toLowerCase()));
  const kwSet = new Set(article.keywords.map((k) => k.toLowerCase()));
  const bodyTokens = tokenize(article.body);
  const bodyCount = new Map<string, number>();
  for (const t of bodyTokens) bodyCount.set(t, (bodyCount.get(t) ?? 0) + 1);

  let score = 0;
  let specificScore = 0; // score contributed by non-generic (meaningful) terms
  for (const term of terms) {
    const generic = GENERIC_TERMS.has(term);
    let termScore = 0;
    if (title.includes(term)) termScore += generic ? 1 : 10;
    if (tagSet.has(term)) termScore += 6;
    if (kwSet.has(term)) termScore += 6;
    if (!generic && article.category.toLowerCase().includes(term)) termScore += 4;
    termScore += Math.min(4, bodyCount.get(term) ?? 0);
    score += termScore;
    if (!generic) specificScore += termScore;
  }
  // Whole-phrase title match bonus (a strong specific signal).
  if (title.includes(query.toLowerCase().trim())) {
    score += 8;
    specificScore += 8;
  }
  // A result must be relevant on a meaningful term, not just a generic word.
  return specificScore > 0 ? score : 0;
}

export function rankArticles<T extends SearchableArticle>(
  articles: T[],
  query: string,
  limit = 10,
): { article: T; score: number }[] {
  return articles
    .map((article) => ({ article, score: scoreArticle(article, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function buildExcerpt(body: string, maxLen = 220): string {
  const plain = body
    .replace(/[#*_`>[\]-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length <= maxLen ? plain : `${plain.slice(0, maxLen).trimEnd()}…`;
}

/** A citation reference to a specific published article version. */
export type CitationRef = {
  articleId: string;
  title: string;
  version: number;
  href: string;
  category: string;
};

export function citationFor(article: {
  id: string;
  title: string;
  version: number;
  slug: string;
  category: string;
}): CitationRef {
  return {
    articleId: article.id,
    title: `${article.title} v${article.version}`,
    version: article.version,
    href: `/app/knowledge/${article.slug}`,
    category: article.category,
  };
}
