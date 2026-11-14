import Link from "next/link";
import { MODE_LABEL, TRACK_LABEL } from "@/lib/academics";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "My classes" };

export default async function Teach() {
  const user = await requireUser();
  // Only the classes this person is assigned to.
  const rows = await prisma.classStaff.findMany({
    where: { userId: user.id },
    include: { class: { include: { course: true, intake: true, studyCentre: true, _count: { select: { enrolments: { where: { status: "ACTIVE" } } } } } } },
    orderBy: { class: { intake: { startDate: "asc" } } },
  });
  return (
    <div className="stack lg">
      <div className="stack"><h1>My classes</h1><p className="muted">The classes you are assigned to teach or support.</p></div>
      {rows.length === 0 && <p className="card">You are not assigned to a class yet. The registrar assigns lecturers and facilitators to classes.</p>}
      <div className="grid">
        {rows.map(({ class: c }) => (
          <Link className="tile" key={c.id} href={`/teach/${c.id}`}>
            <b style={{ fontSize: "1.15rem" }}>{c.course.title}</b>
            <span>{c.intake.name} · {TRACK_LABEL[c.track]} · {MODE_LABEL[c.mode]}{c.studyCentre ? ` · ${c.studyCentre.name}` : ""}<br />{c._count.enrolments} {c._count.enrolments === 1 ? "student" : "students"}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
