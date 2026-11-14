// Prepares the live database, then builds the app. Hosts run this through `npm run vercel-build`.
//
// On the live (production) deployment it:
//   1. checks the settings that must be present;
//   2. creates or updates the database tables (never deletes data);
//   3. loads TIME's schools, programs, courses and intakes (safe to repeat);
//   4. creates the first administrator from ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD,
//      only while the platform has no administrator at all.
// Preview deployments (for example of a pull request) only build: they never touch the database.
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { deployProblems } from "../src/lib/deploy-check";

const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { stdio: "inherit", env: process.env });
const say = (text: string) => console.log(`\n[TIME Learning] ${text}`);

async function prepareDatabase() {
  const problems = deployProblems(process.env);
  if (problems.length) {
    console.error("\n[TIME Learning] The platform cannot go live yet:\n" + problems.map((p) => `  - ${p}`).join("\n") + "\n");
    process.exit(1);
  }
  say("Updating the database tables");
  run("npx", ["prisma", "migrate", "deploy"]);
  say("Loading TIME's programs and courses");
  run("npx", ["tsx", "prisma/seed.ts"]);

  // Imported here, after the checks, because it connects to the database.
  const { prisma } = await import("../src/lib/db");
  const admins = await prisma.user.count({ where: { role: "ADMIN" } });
  await prisma.$disconnect();
  if (admins > 0) {
    say(`The platform has ${admins} administrator account${admins === 1 ? "" : "s"}. ADMIN_PASSWORD is no longer used${process.env.ADMIN_PASSWORD ? ": remove it from the host's settings" : ""}.`);
  } else if (process.env.ADMIN_EMAIL) {
    say("Creating the first administrator");
    run("npx", ["tsx", "scripts/create-admin.ts"]);
  } else {
    say("There is no administrator yet. Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD in the host's settings and deploy again.");
  }
}

async function main() {
  const preview = Boolean(process.env.VERCEL_ENV) && process.env.VERCEL_ENV !== "production";
  if (preview) say("Preview deployment: building only, the database is not touched");
  else await prepareDatabase();
  say("Building the app");
  run("npx", ["next", "build"]);
}

main().catch((e) => { console.error(e); process.exit(1); });
