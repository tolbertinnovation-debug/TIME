// Starts the built app against a fresh test database and gives each test a browser.
import { execFileSync, spawn } from "node:child_process";
import { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { chromium } from "playwright";

export const ROOT = fileURLToPath(new URL("../..", import.meta.url));
export const PORT = 3111;
export const URL_BASE = `http://localhost:${PORT}`;
export const ADMIN = { name: "Test Admin", email: "admin@example.test", password: "admin-password-123" };

const env = {
  ...process.env,
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://time:time@localhost:5432/time_test",
  BETTER_AUTH_SECRET: "test-secret-0123456789-0123456789",
  BETTER_AUTH_URL: URL_BASE,
};
const run = (cmd, args, extra = {}) => execFileSync(cmd, args, { cwd: ROOT, env: { ...env, ...extra }, stdio: "pipe" });

// Empties the test database. It refuses anything that is not clearly a local test database,
// so it can never be pointed at real data by mistake.
async function emptyTestDatabase() {
  const url = new URL(env.DATABASE_URL);
  const name = url.pathname.slice(1);
  if (!name.endsWith("_test") || !["localhost", "127.0.0.1", "postgres"].includes(url.hostname)) {
    throw new Error(`Refusing to empty "${name}" on ${url.hostname}: tests only run against a local database whose name ends in _test.`);
  }
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await client.end();
}

export function useApp() {
  const ctx = {};
  before(async () => {
    await emptyTestDatabase();
    run("npx", ["prisma", "migrate", "deploy"]);
    run("npx", ["tsx", "prisma/seed.ts"]);
    run("npx", ["tsx", "scripts/create-admin.ts"], { ADMIN_NAME: ADMIN.name, ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.password });
    ctx.server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { cwd: ROOT, env, stdio: "ignore" });
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(`${URL_BASE}/sign-in`)).ok) break; } catch { /* not up yet */ }
      await new Promise((r) => setTimeout(r, 500));
    }
    ctx.browser = await chromium.launch();
  });
  after(async () => {
    await ctx.browser?.close();
    ctx.server?.kill();
  });
  return ctx;
}

// A separate browser profile (its own cookies) per person.
export async function person(ctx, viewport = { width: 390, height: 844 }) {
  const context = await ctx.browser.newContext({ viewport });
  const page = await context.newPage();
  page.problems = [];
  page.on("pageerror", (e) => page.problems.push(String(e)));
  // Anything the security headers block shows up here, so every test that checks problems catches it.
  page.on("console", (m) => { if (m.type() === "error" && /Content.Security.Policy|Refused to/i.test(m.text())) page.problems.push(m.text()); });
  return page;
}

// Click a button that sends a form to the server, and wait until the page has settled.
export async function submit(page, selector) {
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.click(selector)]);
  await page.waitForLoadState("networkidle");
}

export async function signUp(page, { name, email, password }, { send = true } = {}) {
  await page.goto(`${URL_BASE}/sign-up`);
  await page.fill("#name", name);
  await page.fill("#email", email);
  await page.fill("#password", password);
  if (send) await submit(page, "form.form button[type=submit]");
  else await page.click("form.form button[type=submit]");
}

export async function signIn(page, { email, password }) {
  await page.goto(`${URL_BASE}/sign-in`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await submit(page, "form.form button[type=submit]");
}

// ---- Shared set-up for tests that need a running class ----

export const DESK = { width: 1280, height: 900 };
export const PEOPLE = {
  registrar: { name: "Rita Registrar", email: "rita@example.test", password: "registrar-password-1" },
  lecturer: { name: "Leo Lecturer", email: "leo@example.test", password: "lecturer-password-1" },
  dean: { name: "Dora Dean", email: "dora@example.test", password: "leadership-password-1" },
  ama: { name: "Ama Kollie", email: "ama@example.test", password: "student-password-1" },
  ben: { name: "Ben Dolo", email: "ben@example.test", password: "student-password-2" },
};

export async function as(ctx, creds, viewport) {
  const page = await person(ctx, viewport);
  await signIn(page, creds);
  return page;
}

// Create an account, then have the administrator give it a role.
export async function makeStaff(ctx, creds, role) {
  const page = await person(ctx);
  await signUp(page, creds);
  await page.context().close();
  const admin = await as(ctx, ADMIN, DESK);
  await admin.goto(`${URL_BASE}/admin/users?q=${encodeURIComponent(creds.email)}`);
  await admin.selectOption("tbody select[name=role]", role);
  await submit(admin, 'tbody button:has-text("Save")');
  await admin.context().close();
}

// An administrator records a confirmed first payment for each named student, which opens their class.
export async function payFirst(ctx, names, amount = "100") {
  const admin = await as(ctx, ADMIN, DESK);
  for (const [i, name] of names.entries()) {
    await admin.goto(`${URL_BASE}/finance/students?q=${encodeURIComponent(name)}`);
    await admin.click(`tbody a:has-text("${name}")`);
    await admin.waitForURL(/\/finance\/students\/.+/);
    await admin.fill("#p-amount", amount);
    await admin.fill("#p-ref", `SETUP-${Date.now()}-${i}`);
    await submit(admin, 'button:has-text("Record payment")');
    await admin.locator('.notice.ok:has-text("Payment recorded")').waitFor();
  }
  await admin.context().close();
}

// An online QuickBooks class with a lecturer and two enrolled students. Returns the class id.
// The students' first payments are recorded so the class is open, unless pay is false.
export async function setUpClass(ctx, { pay = true } = {}) {
  await makeStaff(ctx, PEOPLE.registrar, "REGISTRAR");
  await makeStaff(ctx, PEOPLE.lecturer, "LECTURER");
  await makeStaff(ctx, PEOPLE.dean, "LEADERSHIP");
  for (const s of [PEOPLE.ama, PEOPLE.ben]) { const p = await person(ctx); await signUp(p, s); await p.context().close(); }

  const reg = await as(ctx, PEOPLE.registrar, DESK);
  await reg.goto(`${URL_BASE}/admin/classes`);
  await reg.selectOption("#courseId", { label: "QuickBooks" });
  await reg.selectOption("#intakeId", { label: "March 2027" });
  await reg.selectOption("#mode", "ONLINE");
  await submit(reg, 'button:has-text("Add class")');
  await reg.waitForURL(/\/admin\/classes\/.+/);
  const classId = reg.url().split("?")[0].split("/").pop();
  await reg.selectOption("#staff-user", { label: "Leo Lecturer · Lecturer" });
  await submit(reg, 'button:has-text("Assign")');
  await reg.locator('.notice.ok:has-text("was assigned")').waitFor();
  await reg.goto(`${URL_BASE}/admin/setup`);
  await submit(reg, 'tr:has-text("March 2027") button:has-text("Open for applications")');

  for (const s of [PEOPLE.ama, PEOPLE.ben]) {
    const page = await as(ctx, s);
    await page.goto(`${URL_BASE}/apply`);
    await page.selectOption("#classId", { index: 1 });
    await page.fill("#county", "Margibi");
    await submit(page, 'button:has-text("Send application")');
    await page.context().close();
  }
  await reg.goto(`${URL_BASE}/admin/approvals`);
  for (const left of [1, 0]) {
    await submit(reg, 'article >> nth=0 >> button[value="APPROVED"]');
    await reg.waitForFunction((n) => document.querySelectorAll("article").length === n, left);
  }
  await reg.context().close();
  if (pay) await payFirst(ctx, [PEOPLE.ama.name, PEOPLE.ben.name]);
  return classId;
}

// Run one statement against the test database (used to move a clock back in a test).
export async function testDb(sql, params = []) {
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try { return (await client.query(sql, params)).rows; } finally { await client.end(); }
}
