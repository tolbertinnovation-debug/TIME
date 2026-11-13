import { NavLink } from "@/components/nav-link";
import type { Progress } from "@/lib/progress";
import type { ClassAccess } from "@/lib/permissions";
import { classCan } from "@/lib/permissions";

// Lesson text is plain text: blank lines start a new paragraph. Nothing in it is treated as HTML.
export function LessonBody({ text }: { text: string }) {
  return <div className="lesson-body">{text.split(/\n\s*\n/).map((p, i) => <p key={i}>{p.trim()}</p>)}</div>;
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
      <NavLink href={`/discussion/${classId}`}>Discussion</NavLink>
    </nav>
  );
}
