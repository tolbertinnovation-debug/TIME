// Loads TIME's schools, programs and courses from the website's catalogue (../data/catalogue.json).
// Safe to run again: existing rows are updated, nothing is duplicated.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/db";

type CatalogueCourse = {
  id: string; title: string; school_id: string; program_id: string; program: string;
  duration: string | null; tuition_usd: number | null; installments: number | null;
  delivery_mode: "online" | "blended" | "on-campus"; delivery_confirmed: boolean;
  next_cohorts?: { register_by: string | null; start_date: string }[];
};
type Catalogue = { schools: { id: string; title: string; short: string; blurb: string }[]; courses: CatalogueCourse[] };

const MODE = { online: "ONLINE", blended: "BLENDED", "on-campus": "ON_CAMPUS" } as const;

async function main() {
  const file = process.env.CATALOGUE_FILE ?? new URL("../../data/catalogue.json", import.meta.url).pathname;
  const cat = JSON.parse(readFileSync(file, "utf8")) as Catalogue;

  for (const [sort, s] of cat.schools.entries()) {
    const data = { title: s.title, short: s.short, blurb: s.blurb, sort };
    await prisma.school.upsert({ where: { id: s.id }, create: { id: s.id, ...data }, update: data });
  }
  const programs = new Map<string, string>();
  for (const c of cat.courses) if (!programs.has(c.program_id)) programs.set(c.program_id, c.program);
  for (const [sort, [id, title]] of [...programs].entries()) {
    await prisma.program.upsert({ where: { id }, create: { id, title, sort }, update: { title, sort } });
  }
  for (const [sort, c] of cat.courses.entries()) {
    const data = {
      title: c.title, schoolId: c.school_id, programId: c.program_id, duration: c.duration,
      tuitionUsd: c.tuition_usd, installments: c.installments ?? 1,
      deliveryMode: MODE[c.delivery_mode], deliveryConfirmed: c.delivery_confirmed, sort,
    };
    await prisma.course.upsert({ where: { id: c.id }, create: { id: c.id, ...data }, update: data });
  }
  // Intakes come from the start dates the website publishes. They start as "planned"; staff open them.
  const intakes = new Map<string, string | null>();
  for (const c of cat.courses) for (const k of c.next_cohorts ?? []) if (!intakes.has(k.start_date)) intakes.set(k.start_date, k.register_by);
  const monthYear = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  for (const [start, registerBy] of intakes) {
    const name = monthYear.format(new Date(start));
    const data = { startDate: new Date(start), registerBy: registerBy ? new Date(registerBy) : null };
    await prisma.intake.upsert({ where: { name }, create: { name, ...data }, update: data });
  }
  console.log(`Catalogue loaded: ${cat.schools.length} schools, ${programs.size} programs, ${cat.courses.length} courses, ${intakes.size} intakes.`);
}

main().finally(() => prisma.$disconnect());
