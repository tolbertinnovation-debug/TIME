import { describe, expect, it } from "vitest";
import { can, canDecide, classCan, isRole, REQUESTABLE_ROLES, roleChangeProblem, ROLES, seesApprovals, suspendProblem, visibleApprovalTypes } from "../../src/lib/permissions";

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
    expect(can("REGISTRAR", "approvals.viewAll")).toBe(false);
    expect(can("REGISTRAR", "activity.view")).toBe(false);
  });
});

describe("approvals", () => {
  it("lets an administrator decide every type, and nobody else decide staff access", () => {
    for (const role of ROLES) expect(canDecide(role, "STAFF_ACCESS")).toBe(role === "ADMIN");
  });
  it("lets the registrar and administrators decide applications and enrolment changes", () => {
    for (const type of ["APPLICATION", "ENROLMENT_CHANGE"] as const) {
      expect(ROLES.filter((r) => canDecide(r, type))).toEqual(["REGISTRAR", "ADMIN"]);
    }
  });
  it("shows each role only the approval types it should see", () => {
    expect(visibleApprovalTypes("ADMIN")).toEqual(["STAFF_ACCESS", "APPLICATION", "ENROLMENT_CHANGE", "COURSE_PUBLISH", "GRADES", "GRADE_APPEAL"]);
    expect(visibleApprovalTypes("LEADERSHIP")).toEqual(["STAFF_ACCESS", "APPLICATION", "ENROLMENT_CHANGE", "COURSE_PUBLISH", "GRADES", "GRADE_APPEAL"]);
    expect(visibleApprovalTypes("REGISTRAR")).toEqual(["APPLICATION", "ENROLMENT_CHANGE"]);
    for (const role of ["STUDENT", "LECTURER", "FACILITATOR", "FINANCE"] as const) expect(seesApprovals(role)).toBe(false);
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

describe("academic setup and enrolment", () => {
  it("lets only administrators and the registrar set up intakes and classes", () => {
    expect(ROLES.filter((r) => can(r, "setup.manage"))).toEqual(["REGISTRAR", "ADMIN"]);
  });
  it("lets only students apply, and only administrators reset passwords", () => {
    expect(ROLES.filter((r) => can(r, "classes.apply"))).toEqual(["STUDENT"]);
    expect(ROLES.filter((r) => can(r, "users.resetPassword"))).toEqual(["ADMIN"]);
  });
});

describe("teaching", () => {
  it("lets academic leadership and administrators decide lesson publishing, and nobody else", () => {
    expect(ROLES.filter((r) => canDecide(r, "COURSE_PUBLISH"))).toEqual(["LEADERSHIP", "ADMIN"]);
    expect(ROLES.filter((r) => can(r, "content.review"))).toEqual(["LEADERSHIP", "ADMIN"]);
  });
  it("lets only academic leadership and administrators publish results and decide appeals", () => {
    for (const type of ["GRADES", "GRADE_APPEAL"] as const) expect(ROLES.filter((r) => canDecide(r, type))).toEqual(["LEADERSHIP", "ADMIN"]);
    expect(ROLES.filter((r) => can(r, "results.review"))).toEqual(["LEADERSHIP", "ADMIN"]);
  });
  it("lets a facilitator take attendance but not write lessons, post announcements or mark work", () => {
    expect(classCan("FACILITATOR", "sessions.manage")).toBe(true);
    expect(classCan("FACILITATOR", "content.edit")).toBe(false);
    expect(classCan("FACILITATOR", "announcements.post")).toBe(false);
    expect(classCan("FACILITATOR", "assessments.manage")).toBe(false);
    for (const task of ["content.edit", "announcements.post", "sessions.manage", "assessments.manage"] as const) {
      expect(classCan("LECTURER", task)).toBe(true);
      expect(classCan("ADMIN", task)).toBe(true);
    }
  });
});
