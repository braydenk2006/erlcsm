import { beforeAll, describe, expect, it } from "vitest";
import { createPublicId } from "@commandry/shared";
import { prisma } from "@commandry/database";
import type { Actor } from "@commandry/permissions";
import { buildActorForUser, createOrganization } from "./service";
import {
  createArticle,
  getArticle,
  rollbackArticle,
  searchKnowledge,
  transitionArticle,
  updateArticle,
} from "../knowledge/service";
import { askOrdinex, getAiAnalytics, getConversation, listConversations } from "../ai/service";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("knowledge platform + grounded AI", () => {
  let orgId = "";
  let owner: Actor;
  let articleId = "";

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "KB Owner",
        email: `kb-${Date.now()}@ex.com`,
        emailVerified: true,
      },
    });
    const org = await createOrganization({
      userId: user.id,
      data: { name: "KB Co", slug: `kb-${Date.now()}`, timezone: "UTC" },
    });
    orgId = org.id;
    owner = await buildActorForUser(user.id, orgId);
  });

  it("publishes an article and makes it searchable (drafts are not searchable)", async () => {
    const article = await createArticle({
      actor: owner,
      organizationId: orgId,
      title: "Pursuit Policy",
      category: "policy",
      body: "Officers may engage in a pursuit only when authorized by a supervisor. Terminate the pursuit if it becomes unsafe.",
      tags: ["pursuit", "driving"],
      keywords: ["chase"],
    });
    articleId = article.id;
    expect(
      await searchKnowledge({ actor: owner, organizationId: orgId, query: "pursuit" }),
    ).toHaveLength(0); // draft
    await transitionArticle({
      actor: owner,
      organizationId: orgId,
      id: articleId,
      to: "published",
    });
    const hits = await searchKnowledge({
      actor: owner,
      organizationId: orgId,
      query: "pursuit policy",
    });
    expect(hits[0]!.title).toBe("Pursuit Policy");
    expect(hits[0]!.href).toContain("/app/knowledge/");
  });

  it("versions + rolls back deterministically", async () => {
    await updateArticle({
      actor: owner,
      organizationId: orgId,
      id: articleId,
      body: "COMPLETELY NEW BODY v2",
      changeSummary: "rewrite",
    });
    const afterUpdate = await getArticle({
      actor: owner,
      organizationId: orgId,
      idOrSlug: articleId,
    });
    expect(afterUpdate.article.version).toBe(2);
    expect(afterUpdate.versions.length).toBeGreaterThanOrEqual(2);
    await rollbackArticle({ actor: owner, organizationId: orgId, id: articleId, toVersion: 1 });
    const afterRollback = await getArticle({
      actor: owner,
      organizationId: orgId,
      idOrSlug: articleId,
    });
    expect(afterRollback.article.version).toBe(3);
    expect(afterRollback.article.body).toContain("only when authorized"); // v1 content restored
  });

  it("AI cites the published article for a policy question (grounded, no LLM)", async () => {
    const { answer } = await askOrdinex({
      actor: owner,
      organizationId: orgId,
      question: "Find the pursuit policy",
    });
    expect(answer.usedLLM).toBe(false);
    expect(answer.text).toContain("Pursuit Policy");
    expect(answer.citations.some((c) => c.kind === "knowledge")).toBe(true);
    expect(answer.confidence).toBe("high");
  });

  it("AI explains Community Health from deterministic insights with citations", async () => {
    const { answer } = await askOrdinex({
      actor: owner,
      organizationId: orgId,
      question: "Why is Community Health low?",
    });
    expect(answer.citations.some((c) => c.kind === "health" || c.kind === "insights")).toBe(true);
    expect(answer.text.length).toBeGreaterThan(0);
  });

  it("states a knowledge gap and never fabricates when no document exists", async () => {
    const { answer } = await askOrdinex({
      actor: owner,
      organizationId: orgId,
      question: "Find the canine deployment manual",
    });
    expect(answer.confidence).toBe("none");
    expect(answer.citations).toHaveLength(0);
    expect(answer.text.toLowerCase()).toContain("no published document");
  });

  it("persists conversations + reports analytics", async () => {
    const { conversationId } = await askOrdinex({
      actor: owner,
      organizationId: orgId,
      question: "What should I do next?",
      mode: "recommend",
    });
    const convo = await getConversation({
      actor: owner,
      organizationId: orgId,
      id: conversationId,
    });
    expect(convo.messages.filter((m) => m.role === "assistant").length).toBeGreaterThanOrEqual(1);
    expect(
      (await listConversations({ actor: owner, organizationId: orgId })).length,
    ).toBeGreaterThan(0);
    const analytics = await getAiAnalytics({ actor: owner, organizationId: orgId });
    expect(analytics.totalQuestions).toBeGreaterThanOrEqual(3);
    expect(analytics.knowledgeGaps).toBeGreaterThanOrEqual(1);
    expect(analytics.provider).toBe("grounded");
  });

  it("isolates tenants — AI + search never cross organizations", async () => {
    const otherUser = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "Other",
        email: `kb-o-${Date.now()}@ex.com`,
        emailVerified: true,
      },
    });
    const otherOrg = await createOrganization({
      userId: otherUser.id,
      data: { name: "Other KB", slug: `kb-o-${Date.now()}`, timezone: "UTC" },
    });
    const otherActor = await buildActorForUser(otherUser.id, otherOrg.id);
    const secret = await createArticle({
      actor: otherActor,
      organizationId: otherOrg.id,
      title: "Secret K9 Manual",
      category: "policy",
      body: "Confidential canine procedures.",
      tags: ["k9"],
    });
    await transitionArticle({
      actor: otherActor,
      organizationId: otherOrg.id,
      id: secret.id,
      to: "published",
    });
    // Owner of org1 asks about the other org's article — must not be retrieved.
    const { answer } = await askOrdinex({
      actor: owner,
      organizationId: orgId,
      question: "Find the Secret K9 Manual",
    });
    expect(answer.citations.some((c) => c.label.includes("Secret K9"))).toBe(false);
    // And a cross-tenant search is forbidden.
    await expect(
      searchKnowledge({ actor: otherActor, organizationId: orgId, query: "pursuit" }),
    ).rejects.toThrow();
  });
});
