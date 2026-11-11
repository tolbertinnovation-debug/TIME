import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Programs" };

const MODE = { ONLINE: "Online", BLENDED: "Blended", ON_CAMPUS: "On campus" } as const;

export default async function Catalogue() {
  await requireUser();
  const [schools, programs] = await Promise.all([
    prisma.school.findMany({ orderBy: { sort: "asc" }, include: { courses: { where: { active: true }, orderBy: { sort: "asc" } } } }),
    prisma.program.findMany({ orderBy: { sort: "asc" } }),
  ]);
  const programTitle = new Map(programs.map((p) => [p.id, p.title]));
  return (
    <div className="stack lg">
      <div className="stack">
        <h1>Programs and courses</h1>
        <p className="muted">TIME's catalogue, grouped by school. A delivery mode marked "planned" is still to be confirmed before each intake.</p>
      </div>
      {schools.map((s, i) => (
        <details className="school" key={s.id} open={i === 0}>
          <summary>{s.title} <span className="muted small">· {s.courses.length} courses</span></summary>
          <p className="muted small">{s.blurb}</p>
          <ul>
            {s.courses.map((c) => (
              <li key={c.id}>
                <strong>{c.title}</strong> <span className="muted small">· {programTitle.get(c.programId)}{c.tuitionUsd ? ` · US$${c.tuitionUsd}` : ""}</span>{" "}
                <span className={`pill ${c.deliveryConfirmed ? "" : "plain"}`}>{MODE[c.deliveryMode]}{c.deliveryConfirmed ? "" : " · planned"}</span>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
