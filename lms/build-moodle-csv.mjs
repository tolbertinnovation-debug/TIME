// Generates Moodle bulk-upload CSVs from assets/data/catalogue.json.
// Usage: node lms/build-moodle-csv.mjs   (writes lms/out/*.csv)
// Also checks that every course title in the catalogue still appears on programs.html.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cat = JSON.parse(readFileSync(join(root, "assets/data/catalogue.json"), "utf8"));
const outDir = join(root, "lms/out");
mkdirSync(outDir, { recursive: true });

const csv = (rows) =>
  rows.map((r) => r.map((v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(",")).join("\n") + "\n";

const school = Object.fromEntries(cat.schools.map((s) => [s.id, s]));
const program = Object.fromEntries(cat.programs.map((p) => [p.id, p]));
// Moodle category names may not contain "/", which is the path separator
const clean = (s) => s.replace(/\s*\/\s*/g, " - ");
const categoryPath = (c) => `${clean(school[c.school_id].name)} / ${clean(program[c.program_id].name)}`;

// Drift check: catalogue titles must match the public programs page
const html = readFileSync(join(root, "programs.html"), "utf8")
  .replace(/&amp;/g, "&").replace(/<small>.*?<\/small>/g, "");
const missing = cat.courses.filter((c) => !html.includes(`<span>${c.title}</span>`));
if (missing.length) {
  console.error("Not found on programs.html:", missing.map((c) => c.title).join("; "));
  process.exit(1);
}

// 1. Categories (School / Program), parents first
const cats = new Set();
cat.courses.forEach((c) => {
  cats.add(clean(school[c.school_id].name));
  cats.add(categoryPath(c));
});
writeFileSync(join(outDir, "categories.csv"),
  csv([["category_path"], ...[...cats].sort((a, b) => a.split(" / ").length - b.split(" / ").length || a.localeCompare(b)).map((p) => [p])]));

// 2. One hidden master course per catalogue course (11 sections: Week 0 orientation + Weeks 1–10)
const filled = (v) => v && v !== "TODO";
writeFileSync(join(outDir, "courses.csv"), csv([
  ["shortname", "fullname", "idnumber", "category_path", "format", "numsections", "visible", "summary"],
  ...cat.courses.map((c) => [
    `MASTER-${c.id}`,
    `${c.title} (master)`,
    `MASTER-${c.id}`,
    categoryPath(c),
    "topics",
    11,
    0,
    filled(c.summary) ? c.summary : program[c.program_id].summary,
  ]),
]));

// 3. Cohorts (intake groups) from next_cohorts
const cohortRows = [];
cat.courses.forEach((c) => (c.next_cohorts || []).forEach((k) => {
  const id = `${c.id}-${k.start_date}-${k.track}`;
  cohortRows.push([`${c.title} · ${k.start_date} · ${k.track} · ${k.mode}`, id,
    `Intake starting ${k.start_date}; ${cat.tracks[k.track] || k.track}; ${k.mode}; ${k.seats ?? "?"} seats`,
    categoryPath(c)]);
}));
writeFileSync(join(outDir, "cohorts.csv"), csv([["name", "idnumber", "description", "category_path"], ...cohortRows]));

console.log(`categories: ${cats.size}, master courses: ${cat.courses.length}, cohorts: ${cohortRows.length}`);
if (!cohortRows.length) console.log("No cohorts yet: add next_cohorts entries to catalogue.json and re-run.");
