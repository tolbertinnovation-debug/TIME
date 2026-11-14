import Link from "next/link";
import { notFound } from "next/navigation";
import { signOffPracticalAction } from "@/app/teaching-actions";
import { Notices } from "@/components/notice";
import { requireClassStaff } from "@/lib/class-access";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Sign off practical work" };

export default async function SignOff({ params, searchParams }: { params: Promise<{ id: string; lessonId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id, lessonId } = await params;
  const { cls } = await requireClassStaff(id, "sessions.manage");
  const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, kind: "PRACTICAL", status: "PUBLISHED", module: { courseId: cls.courseId } } });
  if (!lesson) notFound();
  const enrolments = await prisma.enrolment.findMany({
    where: { classId: id, status: "ACTIVE" }, orderBy: { user: { name: "asc" } },
    include: { user: true, progress: { where: { lessonId }, include: { signedOffBy: true } } },
  });
  return (
    <div className="stack lg" style={{ maxWidth: 760 }}>
      <div className="stack">
        <p className="small"><Link href={`/teach/${id}`}>{cls.course.title}</Link></p>
        <h1>Sign off: {lesson.title}</h1>
        <p className="muted">Tick each student who has completed this practical work. Your name is recorded against each sign-off.</p>
        <Notices params={await searchParams} />
      </div>
      {enrolments.length === 0 ? <p className="card">No students are enrolled in this class yet.</p> : (
        <form className="form" action={signOffPracticalAction}>
          <input type="hidden" name="classId" value={id} /><input type="hidden" name="lessonId" value={lessonId} />
          <div className="table-wrap"><table>
            <thead><tr><th>Completed</th><th>Student</th><th>Signed off</th></tr></thead>
            <tbody>
              {enrolments.map((e) => {
                const p = e.progress[0];
                return (
                  <tr key={e.id}>
                    <td><input type="checkbox" id={`done-${e.id}`} name={`done-${e.id}`} defaultChecked={!!p} style={{ width: 22, height: 22 }} /></td>
                    <td><label htmlFor={`done-${e.id}`}>{e.user.name}</label><br /><span className="muted small">{e.user.studentNumber ?? ""}</span></td>
                    <td>{p ? `${p.signedOffBy?.name ?? "A removed account"} · ${formatDate(p.completedAt)}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
          <div><button className="btn" type="submit">Save sign-off</button></div>
        </form>
      )}
    </div>
  );
}
