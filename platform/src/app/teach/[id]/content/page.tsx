import Link from "next/link";
import { createModuleAction, deleteLessonAction, submitForReviewAction, unpublishLessonAction, withdrawReviewAction } from "@/app/teaching-actions";
import { KindPill, TeachNav } from "@/components/learning";
import { Notices } from "@/components/notice";
import { requireClassStaff } from "@/lib/class-access";
import { prisma } from "@/lib/db";

export const metadata = { title: "Lessons" };

const STATUS = { DRAFT: ["plain", "Draft"], IN_REVIEW: ["wait", "In review"], PUBLISHED: ["ok", "Published"] } as const;

export default async function Content({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const { access, cls } = await requireClassStaff(id, "content.edit");
  const modules = await prisma.module.findMany({ where: { courseId: cls.courseId }, orderBy: { sort: "asc" }, include: { lessons: { orderBy: { sort: "asc" } } } });
  const all = modules.flatMap((m) => m.lessons);
  const drafts = all.filter((l) => l.status === "DRAFT").length, inReview = all.filter((l) => l.status === "IN_REVIEW").length;
  return (
    <div className="stack lg">
      <div className="stack">
        <p className="small"><Link href={`/teach/${id}`}>{cls.course.title}</Link></p>
        <h1>Lessons</h1>
        <p className="muted">These lessons belong to the course, so every class of {cls.course.title} shares them. Students see a lesson only after academic leadership has reviewed and published it.</p>
        <TeachNav classId={id} access={access} />
        <Notices params={await searchParams} />
        {inReview > 0 ? (
          <div className="row">
            <span className="notice info">{inReview} {inReview === 1 ? "lesson is" : "lessons are"} waiting for review and cannot be edited.</span>
            <form action={withdrawReviewAction}><input type="hidden" name="classId" value={id} /><button className="btn ghost sm" type="submit">Take back from review</button></form>
          </div>
        ) : drafts > 0 && (
          <form action={submitForReviewAction}><input type="hidden" name="classId" value={id} /><button className="btn" type="submit">Send {drafts} draft {drafts === 1 ? "lesson" : "lessons"} for review</button></form>
        )}
      </div>

      {modules.map((m) => (
        <section className="stack" key={m.id} aria-label={m.title}>
          <h2>{m.title}</h2>
          <div className="table-wrap"><table>
            <thead><tr><th>Lesson</th><th>Kind</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {m.lessons.map((l) => {
                const [cls2, label] = STATUS[l.status];
                return (
                  <tr key={l.id}>
                    <td>{l.title}{l.minutes ? <span className="muted small"> · {l.minutes} min</span> : null}</td>
                    <td><KindPill kind={l.kind} /></td>
                    <td><span className={`pill ${cls2}`}>{label}</span></td>
                    <td>
                      <div className="row">
                        {l.status === "DRAFT" && <Link className="btn ghost sm" href={`/teach/${id}/content/${l.id}`}>Edit</Link>}
                        {l.status === "DRAFT" && <form action={deleteLessonAction}><input type="hidden" name="classId" value={id} /><input type="hidden" name="lessonId" value={l.id} /><button className="btn ghost sm" type="submit">Delete</button></form>}
                        {l.status === "PUBLISHED" && <form action={unpublishLessonAction}><input type="hidden" name="classId" value={id} /><input type="hidden" name="lessonId" value={l.id} /><button className="btn ghost sm" type="submit">Take back to draft</button></form>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {m.lessons.length === 0 && <tr><td colSpan={4}>No lessons in this module yet.</td></tr>}
            </tbody>
          </table></div>
        </section>
      ))}

      <div className="row">
        {modules.length > 0 && <Link className="btn" href={`/teach/${id}/content/new`}>Write a lesson</Link>}
      </div>
      <form className="card form" action={createModuleAction}>
        <h2>Add a module</h2>
        <p className="muted small">A module groups lessons, for example one week of the course.</p>
        <input type="hidden" name="classId" value={id} />
        <div className="field"><label htmlFor="module-title">Module title</label><input id="module-title" name="title" type="text" required maxLength={120} placeholder="Week 1: Getting started" /></div>
        <div><button className="btn ghost" type="submit">Add module</button></div>
      </form>
    </div>
  );
}
