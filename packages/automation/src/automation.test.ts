import { describe, expect, it } from "vitest";
import {
  ACTIONS,
  AUTOMATION_TEMPLATES,
  TRIGGERS,
  evaluateConditions,
  isActionType,
  isEventType,
  nextRetryDelayMs,
  shouldRetry,
  type ConditionGroup,
} from "./index";

describe("registries", () => {
  it("exposes triggers for every event type", () => {
    for (const t of Object.keys(TRIGGERS)) expect(isEventType(t)).toBe(true);
    expect(TRIGGERS["Shift.Completed"].category).toBe("shifts");
  });
  it("marks AI actions as ai-ready and others not", () => {
    expect(ACTIONS.ai_summarize_report.aiReady).toBe(true);
    expect(ACTIONS.send_notification.aiReady).toBe(false);
    expect(isActionType("send_notification")).toBe(true);
    expect(isActionType("nope")).toBe(false);
  });
  it("ships built-in templates referencing valid triggers", () => {
    for (const t of AUTOMATION_TEMPLATES) expect(isEventType(t.trigger)).toBe(true);
  });
});

describe("condition engine", () => {
  const ctx = {
    metadata: { category: "application", loggedMinutes: 90, roles: ["staff", "dispatch"] },
  };
  it("empty conditions pass", () => {
    expect(evaluateConditions({ combinator: "AND", conditions: [] }, ctx)).toBe(true);
  });
  it("evaluates operators against metadata", () => {
    expect(
      evaluateConditions(
        {
          combinator: "AND",
          conditions: [{ field: "metadata.loggedMinutes", op: "gte", value: 60 }],
        },
        ctx,
      ),
    ).toBe(true);
    expect(
      evaluateConditions(
        {
          combinator: "AND",
          conditions: [{ field: "metadata.loggedMinutes", op: "lt", value: 60 }],
        },
        ctx,
      ),
    ).toBe(false);
    expect(
      evaluateConditions(
        {
          combinator: "AND",
          conditions: [{ field: "metadata.roles", op: "contains", value: "dispatch" }],
        },
        ctx,
      ),
    ).toBe(true);
    expect(
      evaluateConditions(
        { combinator: "AND", conditions: [{ field: "category", op: "eq", value: "application" }] },
        ctx,
      ),
    ).toBe(true);
  });
  it("supports OR, nested groups, and negation", () => {
    const g: ConditionGroup = {
      combinator: "OR",
      conditions: [
        { field: "category", op: "eq", value: "leave" },
        {
          combinator: "AND",
          conditions: [{ field: "metadata.loggedMinutes", op: "gt", value: 30 }],
        },
      ],
    };
    expect(evaluateConditions(g, ctx)).toBe(true);
    expect(
      evaluateConditions(
        {
          combinator: "AND",
          negate: true,
          conditions: [{ field: "category", op: "eq", value: "application" }],
        },
        ctx,
      ),
    ).toBe(false);
  });
});

describe("retry/backoff", () => {
  it("computes exponential backoff with a cap", () => {
    expect(nextRetryDelayMs(0, 1000, 60000)).toBe(1000);
    expect(nextRetryDelayMs(3, 1000, 60000)).toBe(8000);
    expect(nextRetryDelayMs(20, 1000, 60000)).toBe(60000);
  });
  it("stops after max attempts", () => {
    expect(shouldRetry(2, 3)).toBe(true);
    expect(shouldRetry(3, 3)).toBe(false);
  });
});
