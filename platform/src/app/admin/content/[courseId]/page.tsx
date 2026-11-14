import Link from "next/link";
import { notFound } from "next/navigation";
import { KindPill, LessonBody } from "@/components/learning";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Review lessons" };

const STATUS = { DRAFT: ["plain", "Draft"], IN_REVIEW: ["wait", "Waiting for your review"], PUBLISHED: ["ok", "Published"] } as const;

// Academic leadership reads every lesson here before deciding in the approvals inbox.
export default async function ReviewContent({ params }: { params: Promise<{ courseId: string }> }) {
  await requireCapability("content.review");
  const { courseId } = await params;
  const course = await prisma.course.findUnique({ where: { id: courseId }, include: { modules: { orderBy: { sort: "asc" }, include: { lessons: { orderBy: { sort: "asc" } } } } } });
  if (!course) notFound();
  return (
    <div className="stack lg">
      <div className="stack">
        <p className="small"><Link href="/admin/approvals">Approvals</Link></p>
        <h1>{course.title}: lessons</h1>
        <p className="muted">Read the lessons waiting for review, then approve or reject them in the approvals inbox.</p>
      </div>
      {course.modules.map((m) => (
        <section className="stack" key={m.id} aria-label={m.title}>
          <h2>{m.title}</h2>
          {m.lessons.map((l) => {
            const [cls, label] = STATUS[l.status];
            return (
              <details className="school" key={l.id} open={l.status === "IN_REVIEW"}>
                <summary>{l.title} <span className={`pill ${cls}`}>{label}</span> <KindPill kind={l.kind} /></summary>
                <div style={{ marginTop: 12 }}><LessonBody text={l.body} /></div>
                {l.resourceUrl && <p className="small" style={{ marginTop: 10 }}>Linked resource: <a href={l.resourceUrl} target="_blank" rel="noopener noreferrer">{l.resourceUrl}</a></p>}
              </details>
            );
          })}
          {m.lessons.length === 0 && <p className="muted">No lessons in this module.</p>}
        </section>
      ))}
      {course.modules.length === 0 && <p className="card">This course has no lessons yet.</p>}
    </div>
  );
}
