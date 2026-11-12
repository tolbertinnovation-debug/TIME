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
  "admin.area": ["ADMIN", "LEADERSHIP", "REGISTRAR", "FINANCE"],
  // Read the full activity log
  "activity.view": ["ADMIN", "LEADERSHIP"],
  // See the list of accounts
  "users.view": ["ADMIN", "LEADERSHIP", "REGISTRAR"],
  // Change roles, suspend and restore accounts
  "users.manage": ["ADMIN"],
  // See every approval request and its outcome, whatever its type
  "approvals.viewAll": ["ADMIN", "LEADERSHIP"],
  // Create intakes, study centres and classes; assign class staff
  "setup.manage": ["ADMIN", "REGISTRAR"],
  // See classes and who is enrolled in them
  "enrolments.view": ["ADMIN", "REGISTRAR", "LEADERSHIP"],
  // Set a new password for another person
  "users.resetPassword": ["ADMIN"],
  // Apply to join a class
  "classes.apply": ["STUDENT"],
  // Read every course's lessons, including drafts, to review them
  "content.review": ["LEADERSHIP", "ADMIN"],
  // See fees, payments and balances
  "finance.view": ["FINANCE", "ADMIN", "LEADERSHIP"],
  // Confirm or reject payments, add charges, record payments, change payment details
  "finance.manage": ["FINANCE", "ADMIN"],
  // Read a class's full gradebook to review results before they are published
  "results.review": ["LEADERSHIP", "ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: Role, capability: Capability): boolean {
  return (CAPABILITIES[capability] as readonly Role[]).includes(role);
}

// Approvals. Each type has its usual approver; a system administrator can always step in.
export const APPROVAL_TYPES = ["STAFF_ACCESS", "APPLICATION", "ENROLMENT_CHANGE", "COURSE_PUBLISH", "GRADES", "GRADE_APPEAL", "PAYMENT_ARRANGEMENT"] as const;
export type ApprovalType = (typeof APPROVAL_TYPES)[number];

export const APPROVAL_LABEL: Record<ApprovalType, string> = {
  STAFF_ACCESS: "Staff access",
  APPLICATION: "Application",
  ENROLMENT_CHANGE: "Withdrawal or deferral",
  COURSE_PUBLISH: "Lessons to publish",
  GRADES: "Results to publish",
  GRADE_APPEAL: "Result appeal",
  PAYMENT_ARRANGEMENT: "More time to pay",
};

const APPROVERS: Record<ApprovalType, readonly Role[]> = {
  STAFF_ACCESS: ["ADMIN"],
  APPLICATION: ["REGISTRAR"],
  ENROLMENT_CHANGE: ["REGISTRAR"],
  COURSE_PUBLISH: ["LEADERSHIP"],
  GRADES: ["LEADERSHIP"],
  GRADE_APPEAL: ["LEADERSHIP"],
  PAYMENT_ARRANGEMENT: ["FINANCE"],
};

// What each kind of class staff may do. An administrator may do all of it, to step in when needed.
export type ClassAccess = "LECTURER" | "FACILITATOR" | "ADMIN";
export const CLASS_TASKS = {
  // Write lessons and send them for review
  "content.edit": ["LECTURER", "ADMIN"],
  // Post announcements to the class
  "announcements.post": ["LECTURER", "ADMIN"],
  // Set assessments, mark work and send results for approval
  "assessments.manage": ["LECTURER", "ADMIN"],
  // Schedule sessions, take attendance, sign off practical work
  "sessions.manage": ["LECTURER", "FACILITATOR", "ADMIN"],
} as const satisfies Record<string, readonly ClassAccess[]>;
export type ClassTask = keyof typeof CLASS_TASKS;

export const classCan = (access: ClassAccess, task: ClassTask) => (CLASS_TASKS[task] as readonly ClassAccess[]).includes(access);

export function canDecide(role: Role, type: ApprovalType): boolean {
  return role === "ADMIN" || APPROVERS[type].includes(role);
}

// The approval types a role sees in the inbox: all of them for administrators and leadership,
// otherwise only the types that role decides.
export function visibleApprovalTypes(role: Role): ApprovalType[] {
  if (can(role, "approvals.viewAll")) return [...APPROVAL_TYPES];
  return APPROVAL_TYPES.filter((t) => APPROVERS[t].includes(role));
}

export const seesApprovals = (role: Role) => visibleApprovalTypes(role).length > 0;

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
