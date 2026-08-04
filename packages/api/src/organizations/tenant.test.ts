import { describe, expect, it } from "vitest";
import { authorize } from "@commandry/permissions";

describe("tenant isolation policy", () => {
  it("blocks organization A actor from reading organization B resources", () => {
    const decision = authorize({
      actor: {
        userId: "usr_a",
        membershipId: "mem_a",
        organizationId: "org_a",
        roleKeys: ["owner"],
        permissionKeys: [],
        departmentIds: [],
      },
      organizationId: "org_a",
      action: "member:read",
      resource: {
        type: "member",
        id: "mem_b",
        organizationId: "org_b",
      },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.matchedRestrictions).toContain("cross_tenant");
  });
});
