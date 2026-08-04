import { describe, expect, it } from "vitest";
import { authorize, explainAccess } from "./authorize";
import type { Actor } from "./types";

const baseActor: Actor = {
  userId: "usr_1",
  membershipId: "mem_1",
  organizationId: "org_1",
  roleKeys: ["staff"],
  permissionKeys: [],
  departmentIds: ["dept_1"],
};

describe("authorize", () => {
  it("allows actions granted by system role", () => {
    const decision = authorize({
      actor: baseActor,
      organizationId: "org_1",
      action: "shift:manage_own",
    });
    expect(decision.allowed).toBe(true);
  });

  it("denies cross-tenant resource access", () => {
    const decision = authorize({
      actor: baseActor,
      organizationId: "org_1",
      action: "member:read",
      resource: {
        type: "member",
        organizationId: "org_2",
        id: "mem_other",
      },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.matchedRestrictions).toContain("cross_tenant");
  });

  it("denies when actor organization mismatches request", () => {
    const decision = authorize({
      actor: baseActor,
      organizationId: "org_2",
      action: "organization:read",
    });
    expect(decision.allowed).toBe(false);
  });

  it("allows owners to manage roles", () => {
    const owner: Actor = { ...baseActor, roleKeys: ["owner"] };
    const decision = authorize({
      actor: owner,
      organizationId: "org_1",
      action: "role:manage",
    });
    expect(decision.allowed).toBe(true);
  });

  it("allows ownership-scoped shift management", () => {
    const decision = authorize({
      actor: { ...baseActor, roleKeys: ["member"], permissionKeys: [] },
      organizationId: "org_1",
      action: "shift:manage_own",
      resource: {
        type: "shift",
        organizationId: "org_1",
        ownerMembershipId: "mem_1",
      },
    });
    expect(decision.allowed).toBe(true);
  });

  it("requires break-glass when configured", () => {
    const decision = authorize({
      actor: { ...baseActor, roleKeys: ["admin"] },
      organizationId: "org_1",
      action: "organization:view_audit",
      context: { requireBreakGlass: true },
    });
    expect(decision.allowed).toBe(false);
  });

  it("explains access for the permission simulator", () => {
    const explanation = explainAccess(baseActor, "erlc:command");
    expect(explanation.allowed).toBe(false);
    expect(explanation.why.join(" ")).toContain("Missing permission");
  });
});
