import { describe, expect, it } from "vitest";
import {
  buildPrompt,
  classifyIntent,
  composeAnswer,
  createGroundedProvider,
  resolveProvider,
  type ComposeInput,
} from "./index";

const baseInput = (over: Partial<ComposeInput>): ComposeInput => ({
  question: "",
  mode: "ask",
  knowledge: [],
  ...over,
});

describe("intent classification", () => {
  it("routes by keywords and mode", () => {
    expect(classifyIntent("Why is Community Health low?", "ask")).toBe("health_explain");
    expect(classifyIntent("Why did attendance drop?", "ask")).toBe("attendance_explain");
    expect(classifyIntent("Find the pursuit policy", "ask")).toBe("knowledge_search");
    expect(classifyIntent("anything", "draft")).toBe("draft");
    expect(classifyIntent("anything", "summarize")).toBe("summarize");
  });
});

describe("grounded composer — grounding + citations + safety", () => {
  it("explains community health from deterministic factors with citations", () => {
    const a = composeAnswer(
      baseInput({
        question: "Why is Community Health low?",
        health: {
          overall: 62,
          severity: "attention",
          trend: "declining",
          weakestFactors: [{ label: "Staffing", score: 40, recommendedAction: "Recruit members" }],
        },
      }),
    );
    expect(a.text).toContain("62");
    expect(a.text).toContain("Staffing");
    expect(a.citations.some((c) => c.kind === "health")).toBe(true);
    expect(a.confidence).toBe("high");
    expect(a.usedLLM).toBe(false);
  });

  it("cites knowledge articles for a policy question", () => {
    const a = composeAnswer(
      baseInput({
        question: "Find the pursuit policy",
        knowledge: [
          {
            id: "1",
            title: "Pursuit Policy",
            version: 3,
            href: "/app/knowledge/pursuit-policy",
            category: "policy",
            excerpt: "Engage only when authorized.",
            score: 20,
          },
        ],
      }),
    );
    expect(a.text).toContain("Pursuit Policy v3");
    expect(a.citations[0]!.kind).toBe("knowledge");
    expect(a.citations[0]!.href).toBe("/app/knowledge/pursuit-policy");
    expect(a.confidence).toBe("high");
  });

  it("states a knowledge gap and offers to draft when no source exists (never fabricates)", () => {
    const a = composeAnswer(
      baseInput({ question: "Find the canine deployment policy", knowledge: [] }),
    );
    expect(a.confidence).toBe("none");
    expect(a.citations).toHaveLength(0);
    expect(a.text.toLowerCase()).toContain("no published document");
    expect(a.suggestedActions.some((s) => s.href.includes("/app/knowledge"))).toBe(true);
  });

  it("labels drafts as AI-generated and never fabricates figures", () => {
    const a = composeAnswer(
      baseInput({ question: "Draft an announcement about training", mode: "draft" }),
    );
    expect(a.isDraft).toBe(true);
    expect(a.text).toContain("AI-generated draft");
  });

  it("presents deterministic recommendations verbatim", () => {
    const a = composeAnswer(
      baseInput({
        question: "What should I do next?",
        mode: "recommend",
        recommendations: [
          {
            text: "Assign another reviewer.",
            reason: "12 pending applications",
            severity: "warning",
          },
        ],
      }),
    );
    expect(a.text).toContain("Assign another reviewer.");
    expect(a.evidence[0]!.detail).toContain("12 pending");
  });
});

describe("prompt orchestration", () => {
  it("builds a per-mode grounded prompt including the evidence", () => {
    const { system, user } = buildPrompt(
      "explain",
      baseInput({
        question: "Explain health",
        health: {
          overall: 70,
          severity: "attention",
          trend: "stable",
          weakestFactors: [
            { label: "Training", score: 50, recommendedAction: "Assign refreshers" },
          ],
        },
      }),
    );
    expect(system).toContain("Never invent");
    expect(user).toContain("Community Health");
    expect(user).toContain("Training 50");
  });
});

describe("provider abstraction", () => {
  it("defaults to the grounded provider when no key is configured", async () => {
    const provider = resolveProvider({});
    expect(provider.name).toBe("grounded");
    expect(provider.usesLLM).toBe(false);
    const a = await provider.generate(
      baseInput({
        question: "Find the radio SOP",
        knowledge: [
          {
            id: "2",
            title: "Radio SOP",
            version: 1,
            href: "/app/knowledge/radio-sop",
            category: "sop",
            excerpt: "Use plain language.",
            score: 10,
          },
        ],
      }),
    );
    expect(a.text).toContain("Radio SOP v1");
  });
  it("selects a live provider when a key is present", () => {
    expect(resolveProvider({ OPENAI_API_KEY: "sk-test" }).usesLLM).toBe(true);
  });
  it("grounded provider is stable/deterministic", async () => {
    const p = createGroundedProvider();
    const input = baseInput({
      question: "Why is Community Health low?",
      health: {
        overall: 55,
        severity: "warning",
        trend: "declining",
        weakestFactors: [{ label: "Attendance", score: 30, recommendedAction: "Schedule patrols" }],
      },
    });
    expect((await p.generate(input)).text).toBe((await p.generate(input)).text);
  });
});
