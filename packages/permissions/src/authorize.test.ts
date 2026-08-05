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

  describe("CAD/MDT v2 granular permissions", () => {
    const owner: Actor = { ...baseActor, roleKeys: ["owner"] };
    const officer: Actor = { ...baseActor, roleKeys: ["staff"] };
    const civilian: Actor = { ...baseActor, roleKeys: ["member"] };

    it("grants owners the full CAD action set", () => {
      for (const action of [
        "cad.access",
        "cad.calls.close",
        "cad.records.approve",
        "cad.configuration.manage",
      ] as const) {
        expect(authorize({ actor: owner, organizationId: "org_1", action }).allowed).toBe(true);
      }
    });

    it("gives line officers MDT + create actions but not privileged ones", () => {
      expect(
        authorize({ actor: officer, organizationId: "org_1", action: "cad.calls.create" }).allowed,
      ).toBe(true);
      expect(
        authorize({ actor: officer, organizationId: "org_1", action: "cad.mdt.access" }).allowed,
      ).toBe(true);
      expect(
        authorize({ actor: officer, organizationId: "org_1", action: "cad.units.manage" }).allowed,
      ).toBe(false);
      expect(
        authorize({ actor: officer, organizationId: "org_1", action: "cad.records.approve" })
          .allowed,
      ).toBe(false);
      expect(
        authorize({ actor: officer, organizationId: "org_1", action: "cad.configuration.manage" })
          .allowed,
      ).toBe(false);
    });

    it("limits members to read-only CAD access", () => {
      expect(
        authorize({ actor: civilian, organizationId: "org_1", action: "cad.access" }).allowed,
      ).toBe(true);
      expect(
        authorize({ actor: civilian, organizationId: "org_1", action: "cad.people.view" }).allowed,
      ).toBe(true);
      expect(
        authorize({ actor: civilian, organizationId: "org_1", action: "cad.calls.create" }).allowed,
      ).toBe(false);
    });

    it("denies CAD actions across tenants even for owners", () => {
      const decision = authorize({
        actor: owner,
        organizationId: "org_1",
        action: "cad.calls.close",
        resource: { type: "cad_call", organizationId: "org_2" },
      });
      expect(decision.allowed).toBe(false);
      expect(decision.matchedRestrictions).toContain("cross_tenant");
    });

    it("preserves legacy coarse cad actions", () => {
      expect(
        authorize({ actor: owner, organizationId: "org_1", action: "cad:dispatch" }).allowed,
      ).toBe(true);
    });
  });
});
