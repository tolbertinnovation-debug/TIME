import Link from "next/link";
import { submitResultsAction, withdrawResultsAction } from "@/app/assessment-actions";
import { GradebookTable } from "@/components/gradebook";
import { TeachNav } from "@/components/learning";
import { Notices } from "@/components/notice";
import { requireClassStaff } from "@/lib/class-access";
import { loadGradebook } from "@/lib/gradebook";
import { CATEGORY_LABEL, PASS_MARK } from "@/lib/grading";

export const metadata = { title: "Gradebook" };

export default async function Gradebook({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const { access, cls } = await requireClassStaff(id, "assessments.manage");
  const book = await loadGradebook(id);
  const inReview = book.rows.some((r) => r.status === "IN_REVIEW");
  const toSend = book.rows.filter((r) => !r.status).length;
  return (
    <div className="stack lg">
      <div className="stack">
        <p className="small"><Link href={`/teach/${id}`}>{cls.course.title}</Link></p>
        <h1>Gradebook</h1>
        <p className="muted">Marks out of 100. The pass mark is {PASS_MARK}. Students see their result only after academic leadership approves it.</p>
        <TeachNav classId={id} access={access} />
        <Notices params={await searchParams} />
        {book.missing.length > 0 && <p className="notice info">No assessment yet for: {book.missing.map((c) => CATEGORY_LABEL[c]).join(", ")}. Those parts count as zero until one is set.</p>}
        {book.unmarked > 0 && <p className="notice info">{book.unmarked} piece{book.unmarked === 1 ? "" : "s"} of handed-in work {book.unmarked === 1 ? "is" : "are"} waiting to be marked.</p>}
      </div>
      <GradebookTable rows={book.rows} />
      {inReview ? (
        <div className="row">
          <span className="notice info">Results are waiting for approval. Marks are locked.</span>
          <form action={withdrawResultsAction}><input type="hidden" name="classId" value={id} /><button className="btn ghost sm" type="submit">Take results back</button></form>
        </div>
      ) : toSend > 0 && (
        <form action={submitResultsAction}><input type="hidden" name="classId" value={id} /><button className="btn" type="submit">Send results for {toSend} {toSend === 1 ? "student" : "students"} for approval</button></form>
      )}
    </div>
  );
}
