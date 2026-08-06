import { describe, expect, it } from "vitest";
import {
  buildExcerpt,
  canTransitionKnowledge,
  citationFor,
  rankArticles,
  scoreArticle,
  slugify,
  tokenize,
  type SearchableArticle,
} from "./index";

const articles: SearchableArticle[] = [
  {
    id: "1",
    title: "Pursuit Policy",
    category: "policy",
    tags: ["pursuit", "driving"],
    keywords: ["chase", "vehicle"],
    body: "Officers may engage in a pursuit only when authorized. Terminate the pursuit if it becomes unsafe.",
  },
  {
    id: "2",
    title: "Radio Procedures",
    category: "radio_procedure",
    tags: ["radio", "comms"],
    keywords: ["10-codes"],
    body: "Use plain language on the radio. Identify your unit before transmitting.",
  },
  {
    id: "3",
    title: "Uniform Policy",
    category: "policy",
    tags: ["uniform"],
    keywords: ["dress"],
    body: "Wear the approved uniform while on duty.",
  },
];

describe("lifecycle", () => {
  it("enforces status transitions", () => {
    expect(canTransitionKnowledge("draft", "review")).toBe(true);
    expect(canTransitionKnowledge("published", "archived")).toBe(true);
    expect(canTransitionKnowledge("superseded", "published")).toBe(false);
  });
});

describe("slugify", () => {
  it("produces url-safe slugs", () => {
    expect(slugify("Pursuit Policy v3.2!")).toBe("pursuit-policy-v32");
    expect(slugify("  Radio / Comms  ")).toBe("radio-comms");
  });
});

describe("deterministic search", () => {
  it("ranks the pursuit policy highest for a pursuit query", () => {
    const ranked = rankArticles(articles, "pursuit policy");
    expect(ranked[0]!.article.id).toBe("1");
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]?.score ?? 0);
  });
  it("matches keywords and tags, not just titles", () => {
    expect(scoreArticle(articles[0]!, "chase")).toBeGreaterThan(0); // keyword
    expect(scoreArticle(articles[1]!, "comms")).toBeGreaterThan(0); // tag
  });
  it("returns nothing for an unrelated query", () => {
    expect(rankArticles(articles, "pizza delivery")).toHaveLength(0);
  });
  it("tokenizes and drops stopwords", () => {
    expect(tokenize("What is the pursuit policy")).toEqual(["pursuit", "policy"]);
  });
});

describe("excerpt + citation", () => {
  it("builds a plain-text excerpt", () => {
    expect(buildExcerpt("# Heading\n**bold** text here")).toContain("Heading");
  });
  it("builds a versioned citation with a link", () => {
    const c = citationFor({
      id: "1",
      title: "Pursuit Policy",
      version: 3,
      slug: "pursuit-policy",
      category: "policy",
    });
    expect(c.title).toBe("Pursuit Policy v3");
    expect(c.href).toBe("/app/knowledge/pursuit-policy");
  });
});
