import { describe, expect, it } from "vitest";
import {
  BUILT_IN_TEMPLATES,
  applyOutcome,
  evaluateStage,
  isFieldVisible,
  pickReviewer,
  sanitizeSubmissionData,
  validateSubmission,
  type WorkflowDefinition,
} from "./index";

describe("form validation", () => {
  const schema = {
    fields: [
      { id: "name", type: "short_text" as const, label: "Name", required: true },
      { id: "email", type: "email" as const, label: "Email", required: true },
      { id: "age", type: "number" as const, label: "Age", validation: { min: 18, max: 99 } },
      {
        id: "why",
        type: "long_text" as const,
        label: "Why",
        visibleIf: { fieldId: "wants", equals: "yes" },
        required: true,
      },
      { id: "wants", type: "toggle" as const, label: "Wants" },
    ],
  };
  it("flags missing required + bad email + out-of-range number", () => {
    const r = validateSubmission(schema, { email: "nope", age: 5 });
    expect(r.valid).toBe(false);
    expect(r.errors.name).toBeDefined();
    expect(r.errors.email).toBeDefined();
    expect(r.errors.age).toBeDefined();
  });
  it("passes valid data and skips hidden conditional fields", () => {
    const r = validateSubmission(schema, { name: "A", email: "a@b.co", age: 20 });
    expect(r.valid).toBe(true);
  });
  it("requires a conditionally-visible field when its condition is met", () => {
    const r = validateSubmission(schema, { name: "A", email: "a@b.co", wants: "yes" });
    expect(isFieldVisible(schema.fields[3]!, { wants: "yes" })).toBe(true);
    expect(r.errors.why).toBeDefined();
  });
  it("sanitizes unknown/injected fields", () => {
    const clean = sanitizeSubmissionData(schema, { name: "A", evil: "x" });
    expect(clean).toEqual({ name: "A" });
  });
});

describe("approval engine", () => {
  const def: WorkflowDefinition = {
    initialStageId: "a",
    stages: [
      {
        id: "a",
        name: "A",
        approvalMode: "ALL",
        assignment: { strategy: "ROLE", target: "admin" },
        onApprove: "b",
        allowRevision: true,
      },
      {
        id: "b",
        name: "B",
        approvalMode: "SINGLE",
        assignment: { strategy: "ROLE", target: "owner" },
        onApprove: "COMPLETE",
      },
    ],
  };
  it("ALL requires every assigned reviewer to approve", () => {
    expect(evaluateStage(def.stages[0]!, ["APPROVE"], 2)).toBe("pending");
    expect(evaluateStage(def.stages[0]!, ["APPROVE", "APPROVE"], 2)).toBe("advance");
  });
  it("any DENY denies; REVISE requests revision when allowed", () => {
    expect(evaluateStage(def.stages[0]!, ["APPROVE", "DENY"], 2)).toBe("deny");
    expect(evaluateStage(def.stages[0]!, ["REVISE"], 2)).toBe("revise");
  });
  it("SINGLE advances on one approval", () => {
    expect(evaluateStage(def.stages[1]!, ["APPROVE"], 1)).toBe("advance");
  });
  it("advances to the next stage, then completes", () => {
    expect(applyOutcome(def, def.stages[0]!, "advance")).toEqual({
      status: "IN_REVIEW",
      stageId: "b",
    });
    expect(applyOutcome(def, def.stages[1]!, "advance")).toEqual({
      status: "COMPLETED",
      stageId: null,
    });
    expect(applyOutcome(def, def.stages[0]!, "deny").status).toBe("DENIED");
  });
});

describe("reviewer assignment", () => {
  it("round-robin picks the least-loaded candidate", () => {
    expect(pickReviewer(["a", "b", "c"], { a: 3, b: 1, c: 2 })).toBe("b");
    expect(pickReviewer([], {})).toBeNull();
  });
});

describe("built-in templates", () => {
  it("ships templates for application, leave, promotion, general, training", () => {
    const cats = BUILT_IN_TEMPLATES.map((t) => t.category);
    expect(cats).toEqual(
      expect.arrayContaining(["application", "leave", "promotion", "general", "training"]),
    );
  });
  it("every template's initial stage exists", () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(t.workflow.stages.some((s) => s.id === t.workflow.initialStageId)).toBe(true);
    }
  });
});
