import { NavLink } from "@/components/nav-link";
import { parseLesson, type Inline } from "@/lib/lesson-text";
import type { Progress } from "@/lib/progress";
import type { ClassAccess } from "@/lib/permissions";
import { classCan } from "@/lib/permissions";

const inline = (parts: Inline[]) => parts.map((part, i) => (part.bold ? <strong key={i}>{part.text}</strong> : <span key={i}>{part.text}</span>));

// A lesson's text with its headings, lists and bold (see lib/lesson-text.ts). Nothing in it is treated as HTML.
export function LessonBody({ text }: { text: string }) {
  return (
    <div className="lesson-body">
      {parseLesson(text).map((b, i) => {
        if (b.type === "heading") return b.level === 2 ? <h2 key={i}>{inline(b.content)}</h2> : <h3 key={i}>{inline(b.content)}</h3>;
        if (b.type === "list") {
          const items = b.items.map((item, j) => <li key={j}>{inline(item)}</li>);
          return b.ordered ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>;
        }
        return <p key={i}>{inline(b.content)}</p>;
      })}
    </div>
  );
}

export function ProgressBar({ progress }: { progress: Progress }) {
  const total = progress.onlineTotal + progress.practicalTotal;
  const pct = (n: number) => (total ? `${(n / total) * 100}%` : "0%");
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="bar" role="img" aria-label={`${progress.percent}% of the course complete`}>
        <i style={{ width: pct(progress.onlineDone) }} /><i className="practical" style={{ width: pct(progress.practicalDone) }} />
      </div>
      <div className="legend">
        <span>Online {progress.onlineDone} of {progress.onlineTotal}</span>
        <span className="practical">Practical {progress.practicalDone} of {progress.practicalTotal}</span>
      </div>
    </div>
  );
}

export const KIND_LABEL = { ONLINE: "Online", PRACTICAL: "Practical" } as const;
export function KindPill({ kind }: { kind: keyof typeof KIND_LABEL }) {
  return <span className={`pill ${kind === "PRACTICAL" ? "practical" : ""}`}>{KIND_LABEL[kind]}</span>;
}

export function TeachNav({ classId, access }: { classId: string; access: ClassAccess }) {
  return (
    <nav className="subnav" aria-label="Class">
      <NavLink href={`/teach/${classId}`} exact>Students</NavLink>
      {classCan(access, "content.edit") && <NavLink href={`/teach/${classId}/content`}>Lessons</NavLink>}
      <NavLink href={`/teach/${classId}/sessions`}>Sessions and attendance</NavLink>
      {classCan(access, "assessments.manage") && <NavLink href={`/teach/${classId}/assessments`}>Assessments</NavLink>}
      {classCan(access, "assessments.manage") && <NavLink href={`/teach/${classId}/gradebook`}>Gradebook</NavLink>}
      {classCan(access, "assessments.manage") && <NavLink href={`/teach/${classId}/evaluations`}>Evaluations</NavLink>}
      <NavLink href={`/discussion/${classId}`}>Discussion</NavLink>
    </nav>
  );
}
