import Link from "next/link";
import { notFound } from "next/navigation";
import { completeLessonAction } from "@/app/learning-actions";
import { KindPill, LessonBody } from "@/components/learning";
import { Notices } from "@/components/notice";
import { LessonVideo } from "@/components/video";
import { requireEnrolment } from "@/lib/class-access";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { neighbours } from "@/lib/progress";
import { youtubeEmbedUrl, youtubeId } from "@/lib/video";

export const metadata = { title: "Lesson" };

export default async function LessonPage({ params, searchParams }: { params: Promise<{ classId: string; lessonId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { classId, lessonId } = await params;
  const { enrolment, cls } = await requireEnrolment(classId);
  // The lesson must be published and belong to this class's course.
  const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, status: "PUBLISHED", module: { courseId: cls.courseId } }, include: { module: true } });
  if (!lesson) notFound();
  const progress = await prisma.lessonProgress.findUnique({ where: { enrolmentId_lessonId: { enrolmentId: enrolment.id, lessonId } }, include: { signedOffBy: true } });
  // The lessons before and after this one, in the order of the course.
  const modules = await prisma.module.findMany({ where: { courseId: cls.courseId }, orderBy: { sort: "asc" }, select: { lessons: { where: { status: "PUBLISHED" }, orderBy: { sort: "asc" }, select: { id: true, title: true } } } });
  const all = modules.flatMap((m) => m.lessons);
  const { previous, next } = neighbours(all, lessonId);
  const position = all.findIndex((l) => l.id === lessonId) + 1;
  const video = lesson.videoUrl ? youtubeId(lesson.videoUrl) : null;
  return (
    <article className="stack lg">
      <div className="stack">
        <p className="small"><Link href={`/learn/${classId}`}>{cls.course.title}</Link> · {lesson.module.title}</p>
        <h1>{lesson.title}</h1>
        <p className="row"><KindPill kind={lesson.kind} />{lesson.minutes ? <span className="muted small">{lesson.minutes} min</span> : null}</p>
        <Notices params={await searchParams} />
      </div>
      {video && <LessonVideo embedUrl={youtubeEmbedUrl(video)} watchUrl={lesson.videoUrl!} title={lesson.title} />}
      <LessonBody text={lesson.body} />
      {lesson.resourceUrl && <p><a className="btn ghost" href={lesson.resourceUrl} target="_blank" rel="noopener noreferrer">Open the notes, slides or audio for this lesson</a></p>}
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
      <nav className="lesson-nav" aria-label="Lessons">
        {previous ? <Link className="lesson-step" href={`/learn/${classId}/${previous.id}`}><span className="small muted">‹ Previous lesson</span><strong>{previous.title}</strong></Link> : <span />}
        <span className="small muted lesson-count">Lesson {position} of {all.length}</span>
        {next ? <Link className="lesson-step next" href={`/learn/${classId}/${next.id}`}><span className="small muted">Next lesson ›</span><strong>{next.title}</strong></Link> : <span />}
      </nav>
    </article>
  );
}
