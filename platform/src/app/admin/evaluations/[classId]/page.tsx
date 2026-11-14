import Link from "next/link";
import { notFound } from "next/navigation";
import { EvaluationSummary } from "@/components/evaluation";
import { classLabel } from "@/lib/academics";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Course evaluation" };

export default async function ClassEvaluation({ params }: { params: Promise<{ classId: string }> }) {
  await requireCapability("results.review");
  const { classId } = await params;
  const cls = await prisma.courseClass.findUnique({ where: { id: classId }, include: { course: true, intake: true } });
  if (!cls) notFound();
  return (
    <div className="stack lg">
      <div className="stack">
        <p className="small"><Link href="/admin/evaluations">Course evaluations</Link></p>
        <h1>{classLabel(cls)}</h1>
      </div>
      <EvaluationSummary classId={classId} />
    </div>
  );
}
