import Link from "next/link";
import { notFound } from "next/navigation";
import { completeLessonAction } from "@/app/learning-actions";
import { KindPill, LessonBody } from "@/components/learning";
import { Notices } from "@/components/notice";
import { requireEnrolment } from "@/lib/class-access";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Lesson" };

export default async function LessonPage({ params, searchParams }: { params: Promise<{ classId: string; lessonId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { classId, lessonId } = await params;
  const { enrolment, cls } = await requireEnrolment(classId);
  // The lesson must be published and belong to this class's course.
  const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, status: "PUBLISHED", module: { courseId: cls.courseId } }, include: { module: true } });
  if (!lesson) notFound();
  const progress = await prisma.lessonProgress.findUnique({ where: { enrolmentId_lessonId: { enrolmentId: enrolment.id, lessonId } }, include: { signedOffBy: true } });
  return (
    <article className="stack lg">
      <div className="stack">
        <p className="small"><Link href={`/learn/${classId}`}>{cls.course.title}</Link> · {lesson.module.title}</p>
        <h1>{lesson.title}</h1>
        <p className="row"><KindPill kind={lesson.kind} />{lesson.minutes ? <span className="muted small">{lesson.minutes} min</span> : null}</p>
        <Notices params={await searchParams} />
      </div>
      <LessonBody text={lesson.body} />
      {lesson.resourceUrl && <p><a className="btn ghost" href={lesson.resourceUrl} target="_blank" rel="noopener noreferrer">Open the notes or audio for this lesson</a></p>}
      <div className="card stack" style={{ maxWidth: 520 }}>
        {progress ? (
          <p className="notice ok">{lesson.kind === "PRACTICAL" ? `Signed off by ${progress.signedOffBy?.name ?? "TIME staff"} on ${formatDate(progress.completedAt)}.` : `You completed this lesson on ${formatDate(progress.completedAt)}.`}</p>
        ) : lesson.kind === "PRACTICAL" ? (
          <p className="muted">This is practical work. Your lecturer or study centre facilitator signs it off when you have done it.</p>
        ) : enrolment.status === "ACTIVE" ? (
          <form action={completeLessonAction}>
            <input type="hidden" name="classId" value={classId} /><input type="hidden" name="lessonId" value={lessonId} />
            <button className="btn" type="submit">Mark lesson complete</button>
          </form>
        ) : null}
        <p className="small"><Link href={`/learn/${classId}`}>Back to all lessons</Link></p>
      </div>
    </article>
  );
}
