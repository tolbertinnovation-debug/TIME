// Who may do what. Every page and every action checks these rules on the server;
// hiding a link in the menu is never the protection.

export const ROLES = ["STUDENT", "LECTURER", "FACILITATOR", "REGISTRAR", "FINANCE", "LEADERSHIP", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  STUDENT: "Student",
  LECTURER: "Lecturer",
  FACILITATOR: "Study centre facilitator",
  REGISTRAR: "Registrar",
  FINANCE: "Finance officer",
  LEADERSHIP: "Academic leadership",
  ADMIN: "System administrator",
};

export const CAPABILITIES = {
  // See the administration area at all
  "admin.area": ["ADMIN", "LEADERSHIP", "REGISTRAR"],
  // Read the full activity log
  "activity.view": ["ADMIN", "LEADERSHIP"],
  // See the list of accounts
  "users.view": ["ADMIN", "LEADERSHIP", "REGISTRAR"],
  // Change roles, suspend and restore accounts
  "users.manage": ["ADMIN"],
  // See every approval request and its outcome
  "approvals.view": ["ADMIN", "LEADERSHIP"],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: Role, capability: Capability): boolean {
  return (CAPABILITIES[capability] as readonly Role[]).includes(role);
}

// Approvals. Each type has its usual approver; a system administrator can always step in.
export const APPROVAL_TYPES = ["STAFF_ACCESS"] as const;
export type ApprovalType = (typeof APPROVAL_TYPES)[number];

export const APPROVAL_LABEL: Record<ApprovalType, string> = {
  STAFF_ACCESS: "Staff access",
};

const APPROVERS: Record<ApprovalType, readonly Role[]> = {
  STAFF_ACCESS: ["ADMIN"],
};

export function canDecide(role: Role, type: ApprovalType): boolean {
  return role === "ADMIN" || APPROVERS[type].includes(role);
}

// Roles a person may ask for. Administrator access is only ever given directly by another administrator.
export const REQUESTABLE_ROLES = ["LECTURER", "FACILITATOR", "REGISTRAR", "FINANCE", "LEADERSHIP"] as const satisfies readonly Role[];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

// Rules for changing another account, so the platform can never be left without an administrator.
export function roleChangeProblem(input: {
  actorId: string;
  actorRole: Role;
  targetId: string;
  targetRole: Role;
  newRole: Role;
  activeAdminCount: number;
}): string | null {
  if (!can(input.actorRole, "users.manage")) return "You are not allowed to change roles.";
  if (input.actorId === input.targetId) return "You cannot change your own role. Ask another administrator.";
  if (input.targetRole === "ADMIN" && input.newRole !== "ADMIN" && input.activeAdminCount <= 1) {
    return "This is the only administrator. Make another person an administrator first.";
  }
  return null;
}

export function suspendProblem(input: {
  actorId: string;
  actorRole: Role;
  targetId: string;
  targetRole: Role;
  activeAdminCount: number;
}): string | null {
  if (!can(input.actorRole, "users.manage")) return "You are not allowed to suspend accounts.";
  if (input.actorId === input.targetId) return "You cannot suspend your own account.";
  if (input.targetRole === "ADMIN" && input.activeAdminCount <= 1) return "This is the only administrator and cannot be suspended.";
  return null;
}
