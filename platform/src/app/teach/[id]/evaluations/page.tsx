import { EvaluationSummary } from "@/components/evaluation";
import { TeachNav } from "@/components/learning";
import { classLabel } from "@/lib/academics";
import { requireClassStaff } from "@/lib/class-access";

export const metadata = { title: "Course evaluations" };

export default async function ClassEvaluations({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { access, cls } = await requireClassStaff(id, "assessments.manage");
  return (
    <div className="stack lg">
      <div className="stack"><h1>Course evaluations</h1><p className="muted">{classLabel(cls)}</p></div>
      <TeachNav classId={id} access={access} />
      <EvaluationSummary classId={id} />
    </div>
  );
}
