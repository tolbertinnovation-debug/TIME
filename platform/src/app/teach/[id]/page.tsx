import Link from "next/link";
import { notFound } from "next/navigation";
import { Roster } from "@/components/roster";
import { MODE_LABEL, TRACK_LABEL } from "@/lib/academics";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Class" };

export default async function TeachClass({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  // A lecturer or facilitator can open a class only if they are assigned to it.
  const assignment = await prisma.classStaff.findUnique({ where: { classId_userId: { classId: id, userId: user.id } } });
  if (!assignment) notFound();
  const cls = await prisma.courseClass.findUniqueOrThrow({
    where: { id },
    include: { course: true, intake: true, studyCentre: true, enrolments: { where: { status: "ACTIVE" }, include: { user: true }, orderBy: { user: { name: "asc" } } } },
  });
  return (
    <div className="stack lg">
      <div className="stack">
        <p className="small"><Link href="/teach">My classes</Link></p>
        <h1>{cls.course.title}</h1>
        <p className="muted">{cls.intake.name} · {TRACK_LABEL[cls.track]} · {MODE_LABEL[cls.mode]}{cls.studyCentre ? ` · ${cls.studyCentre.name}` : ""}</p>
      </div>
      <section className="stack" aria-labelledby="roster-h">
        <h2 id="roster-h">Students ({cls.enrolments.length})</h2>
        <Roster enrolments={cls.enrolments} />
      </section>
    </div>
  );
}
