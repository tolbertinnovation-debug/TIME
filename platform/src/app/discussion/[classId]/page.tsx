import Link from "next/link";
import { notFound } from "next/navigation";
import { hidePostAction, postAction } from "@/app/community-actions";
import { Notices } from "@/components/notice";
import { classLabel } from "@/lib/academics";
import { classAccess } from "@/lib/class-access";
import { prisma } from "@/lib/db";
import { accessProblem, feeStatusOf } from "@/lib/fees-data";
import { formatDateTime } from "@/lib/format";
import { classCan } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Class discussion" };

export default async function Discussion({ params, searchParams }: { params: Promise<{ classId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const { classId } = await params;
  // Open to the class's staff, and to students who are enrolled and whose fees allow access.
  const access = await classAccess(user, classId);
  if (!access) {
    const enrolment = await prisma.enrolment.findUnique({ where: { userId_classId: { userId: user.id, classId } } });
    if (!enrolment || enrolment.status !== "ACTIVE" || accessProblem(await feeStatusOf(enrolment.id))) notFound();
  }
  const cls = await prisma.courseClass.findUnique({ where: { id: classId }, include: { course: true, intake: true, staff: true } });
  if (!cls) notFound();
  const threads = await prisma.post.findMany({
    where: { classId, parentId: null }, orderBy: { createdAt: "desc" }, take: 50,
    include: { author: true, replies: { orderBy: { createdAt: "asc" }, include: { author: true } } },
  });
  const staffIds = new Set(cls.staff.map((s) => s.userId));
  const moderate = !!access && classCan(access, "discussion.moderate");
  const by = (p: { author: { id: string; name: string } | null }) => `${p.author?.name ?? "A removed account"}${p.author && staffIds.has(p.author.id) ? " (staff)" : ""}`;
  const remove = (postId: string) => moderate && (
    <form action={hidePostAction}><input type="hidden" name="classId" value={classId} /><input type="hidden" name="postId" value={postId} /><button className="btn ghost sm" type="submit">Remove</button></form>
  );
  return (
    <div className="stack lg" style={{ maxWidth: 760 }}>
      <div className="stack">
        <p className="small"><Link href={access ? `/teach/${classId}` : `/learn/${classId}`}>{cls.course.title}</Link></p>
        <h1>Class discussion</h1>
        <p className="muted">{classLabel(cls)}. Ask a question about the course, or help a classmate. Everyone in the class can read what you write.</p>
        <Notices params={await searchParams} />
      </div>
      <form className="card form" action={postAction}>
        <input type="hidden" name="classId" value={classId} />
        <div className="field"><label htmlFor="new-post">Ask a question</label><textarea id="new-post" name="body" required minLength={2} maxLength={3000} /></div>
        <div><button className="btn" type="submit">Post question</button></div>
      </form>
      {threads.length === 0 && <p className="muted">No questions yet. Be the first to ask.</p>}
      {threads.map((t) => (
        <article className="card stack" key={t.id} id={`post-${t.id}`}>
          {t.hiddenAt ? <p className="muted">This question was removed by the lecturer.</p> : (
            <>
              <div className="row between"><p className="small muted"><strong>{by(t)}</strong> · {formatDateTime(t.createdAt)}</p>{remove(t.id)}</div>
              <p style={{ whiteSpace: "pre-line" }}>{t.body}</p>
            </>
          )}
          {t.replies.map((r) => (
            <div key={r.id} style={{ borderLeft: "3px solid var(--line)", paddingLeft: 14 }} className="stack reply">
              {r.hiddenAt ? <p className="muted small">This reply was removed by the lecturer.</p> : (
                <>
                  <div className="row between"><p className="small muted"><strong>{by(r)}</strong> · {formatDateTime(r.createdAt)}</p>{remove(r.id)}</div>
                  <p style={{ whiteSpace: "pre-line" }}>{r.body}</p>
                </>
              )}
            </div>
          ))}
          {!t.hiddenAt && (
            <form className="inline-form" action={postAction} style={{ alignItems: "flex-end" }}>
              <input type="hidden" name="classId" value={classId} /><input type="hidden" name="parentId" value={t.id} />
              <label className="skip" htmlFor={`reply-${t.id}`}>Reply</label>
              <input id={`reply-${t.id}`} name="body" type="text" required minLength={2} maxLength={3000} placeholder="Write a reply" style={{ flex: "1 1 220px", width: "auto" }} />
              <button className="btn ghost sm" type="submit">Reply</button>
            </form>
          )}
        </article>
      ))}
    </div>
  );
}
