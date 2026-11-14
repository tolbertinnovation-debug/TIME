import { audit } from "@/lib/audit";
import { toCsv } from "@/lib/csv";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { buildReport, isReportKind, REPORTS } from "@/lib/reports";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// Downloads one report as a CSV file. Every download is written to the activity log.
export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const user = await getCurrentUser();
  // The same answer whether the report does not exist or the person may not have it.
  if (!user || !isReportKind(kind) || !can(user.role, REPORTS[kind].capability)) return new Response("Not found", { status: 404 });

  const intakeId = new URL(request.url).searchParams.get("intake") || null;
  const intake = intakeId ? await prisma.intake.findUnique({ where: { id: intakeId } }) : null;
  if (intakeId && !intake) return new Response("Not found", { status: 404 });

  const report = await buildReport(kind, intakeId);
  const scope = intake ? intake.name : "all intakes";
  await audit({ actor: user, action: "report.downloaded", summary: `${user.name} downloaded the ${REPORTS[kind].title.toLowerCase()} report (${scope}, ${report.rows.length} ${report.rows.length === 1 ? "row" : "rows"})`, entityType: "report", entityId: kind, meta: { intakeId, rows: report.rows.length } });

  const name = `time-${kind}-${scope.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(toCsv(report.header, report.rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
