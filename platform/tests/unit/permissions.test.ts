import { describe, expect, it } from "vitest";
import { can, canDecide, isRole, REQUESTABLE_ROLES, roleChangeProblem, ROLES, suspendProblem } from "../../src/lib/permissions";

describe("capabilities", () => {
  it("lets only administrators manage accounts", () => {
    for (const role of ROLES) expect(can(role, "users.manage")).toBe(role === "ADMIN");
  });
  it("shows the activity log to administrators and leadership only", () => {
    expect(ROLES.filter((r) => can(r, "activity.view"))).toEqual(["LEADERSHIP", "ADMIN"]);
  });
  it("keeps students, lecturers, facilitators and finance out of the administration area", () => {
    for (const role of ["STUDENT", "LECTURER", "FACILITATOR", "FINANCE"] as const) expect(can(role, "admin.area")).toBe(false);
  });
  it("lets the registrar see accounts but not approvals or activity", () => {
    expect(can("REGISTRAR", "users.view")).toBe(true);
    expect(can("REGISTRAR", "approvals.view")).toBe(false);
    expect(can("REGISTRAR", "activity.view")).toBe(false);
  });
});

describe("approvals", () => {
  it("lets an administrator decide every type, and nobody else decide staff access", () => {
    for (const role of ROLES) expect(canDecide(role, "STAFF_ACCESS")).toBe(role === "ADMIN");
  });
  it("never lets someone request administrator access", () => {
    expect((REQUESTABLE_ROLES as readonly string[]).includes("ADMIN")).toBe(false);
    expect((REQUESTABLE_ROLES as readonly string[]).includes("STUDENT")).toBe(false);
  });
});

describe("isRole", () => {
  it("accepts known roles only", () => {
    expect(isRole("LECTURER")).toBe(true);
    for (const bad of ["admin", "OWNER", "", null, 7, undefined]) expect(isRole(bad)).toBe(false);
  });
});

describe("changing roles", () => {
  const base = { actorId: "a", actorRole: "ADMIN", targetId: "b", targetRole: "STUDENT", newRole: "LECTURER", activeAdminCount: 2 } as const;
  it("allows an administrator to change someone else's role", () => expect(roleChangeProblem(base)).toBeNull());
  it("refuses anyone who is not an administrator", () => {
    for (const actorRole of ROLES.filter((r) => r !== "ADMIN")) expect(roleChangeProblem({ ...base, actorRole })).toMatch(/not allowed/);
  });
  it("refuses changing your own role", () => expect(roleChangeProblem({ ...base, targetId: "a", targetRole: "ADMIN" })).toMatch(/your own role/));
  it("refuses demoting the only administrator", () => {
    expect(roleChangeProblem({ ...base, targetRole: "ADMIN", newRole: "STUDENT", activeAdminCount: 1 })).toMatch(/only administrator/);
    expect(roleChangeProblem({ ...base, targetRole: "ADMIN", newRole: "STUDENT", activeAdminCount: 2 })).toBeNull();
  });
});

describe("suspending accounts", () => {
  const base = { actorId: "a", actorRole: "ADMIN", targetId: "b", targetRole: "STUDENT", activeAdminCount: 2 } as const;
  it("allows an administrator to suspend someone else", () => expect(suspendProblem(base)).toBeNull());
  it("refuses other roles, yourself, and the only administrator", () => {
    expect(suspendProblem({ ...base, actorRole: "LEADERSHIP" })).toMatch(/not allowed/);
    expect(suspendProblem({ ...base, targetId: "a" })).toMatch(/your own/);
    expect(suspendProblem({ ...base, targetRole: "ADMIN", activeAdminCount: 1 })).toMatch(/only administrator/);
  });
});
