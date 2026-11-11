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
