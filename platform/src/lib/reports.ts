import { ENROLMENT_LABEL, MODE_LABEL, TRACK_LABEL } from "@/lib/academics";
import type { Cell } from "@/lib/csv";
import { prisma } from "@/lib/db";
import { METHOD_LABEL } from "@/lib/fees";
import type { Capability } from "@/lib/permissions";

// The reports staff can download. Each says who may download it and builds its rows.
export type Report = { header: string[]; rows: Cell[][] };
export const REPORT_KINDS = ["enrolment", "results", "payments", "refunds"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];
export const isReportKind = (v: string): v is ReportKind => (REPORT_KINDS as readonly string[]).includes(v);

export const REPORTS: Record<ReportKind, { title: string; about: string; capability: Capability }> = {
  enrolment: { title: "Enrolment", about: "Every student in every class: student number, county, course, program, intake, study centre and status.", capability: "records.view" },
  results: { title: "Results", about: "Every published result: points in each part, total, pass or not, and the certificate number if one was issued.", capability: "records.view" },
  payments: { title: "Payments", about: "Every confirmed payment: receipt number, date, student, class, amount, method and reference.", capability: "finance.view" },
  refunds: { title: "Refunds", about: "Every approved refund: who approved it, the reason, and whether, when and how it was sent.", capability: "finance.view" },
};

const classInclude = { course: { include: { program: true } }, intake: true, studyCentre: true } as const;

export async function buildReport(kind: ReportKind, intakeId: string | null): Promise<Report> {
  const inIntake = intakeId ? { class: { intakeId } } : {};
  if (kind === "enrolment") {
    const list = await prisma.enrolment.findMany({ where: inIntake, orderBy: [{ class: { intake: { startDate: "asc" } } }, { enrolledAt: "asc" }], include: { user: true, class: { include: classInclude } } });
    return {
      header: ["Student number", "Name", "County", "Course", "Program", "Intake", "Schedule", "Delivery", "Study centre", "Status", "Enrolled on"],
      rows: list.map((e) => [e.user.studentNumber, e.user.name, e.user.county, e.class.course.title, e.class.course.program.title, e.class.intake.name, TRACK_LABEL[e.class.track], MODE_LABEL[e.class.mode], e.class.studyCentre?.name, ENROLMENT_LABEL[e.status], e.enrolledAt]),
    };
  }
  if (kind === "results") {
    // Only published results leave the platform; results still in review do not.
    const list = await prisma.result.findMany({ where: { status: "PUBLISHED", enrolment: inIntake }, orderBy: { publishedAt: "asc" }, include: { enrolment: { include: { user: true, certificate: true, class: { include: classInclude } } } } });
    return {
      header: ["Student number", "Name", "Course", "Program", "Intake", "Continuous assessment (30)", "Assignments and practical (20)", "Midterm (20)", "Final (30)", "Total (100)", "Passed", "Published on", "Certificate number"],
      rows: list.map((r) => {
        const e = r.enrolment, cert = e.certificate && !e.certificate.revokedAt ? e.certificate.number : null;
        return [e.user.studentNumber, e.user.name, e.class.course.title, e.class.course.program.title, e.class.intake.name, r.continuous, r.assignments, r.midterm, r.final, r.total, r.passed, r.publishedAt, cert];
      }),
    };
  }
  if (kind === "refunds") {
    const list = await prisma.refund.findMany({ where: { enrolment: inIntake }, orderBy: { createdAt: "asc" }, include: { paidBy: true, enrolment: { include: { user: true, class: { include: classInclude } } } } });
    return {
      header: ["Approved on", "Approved by", "Student number", "Name", "Course", "Intake", "Amount (USD)", "Reason", "Sent", "Sent on", "Method", "Reference", "Sent by"],
      rows: list.map((r) => [r.createdAt, r.approvedByName, r.enrolment.user.studentNumber, r.enrolment.user.name, r.enrolment.class.course.title, r.enrolment.class.intake.name, r.amountCents / 100, r.reason, r.status === "PAID", r.paidOn, r.method ? METHOD_LABEL[r.method] : null, r.reference, r.paidBy?.name]),
    };
  }
  const list = await prisma.payment.findMany({ where: { status: "CONFIRMED", enrolment: inIntake }, orderBy: { decidedAt: "asc" }, include: { decidedBy: true, enrolment: { include: { user: true, class: { include: classInclude } } } } });
  return {
    header: ["Receipt number", "Paid on", "Student number", "Name", "Course", "Intake", "Amount (USD)", "Method", "Reference", "Confirmed on", "Confirmed by"],
    rows: list.map((p) => [p.receiptNumber, p.paidOn, p.enrolment.user.studentNumber, p.enrolment.user.name, p.enrolment.class.course.title, p.enrolment.class.intake.name, p.amountCents / 100, METHOD_LABEL[p.method], p.reference, p.decidedAt, p.decidedBy?.name]),
  };
}
