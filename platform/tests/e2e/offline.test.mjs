import { test } from "node:test";
import assert from "node:assert/strict";
import { PEOPLE, URL_BASE, as, person, setUpClass, submit, testDb, useApp } from "./helpers.mjs";

const ctx = useApp();
let classId, lessons;

// Wait until the service worker is running and in charge of the page.
async function workerReady(page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}
const keptPages = (page) => page.evaluate(async () => (await (await caches.open("time-pages-v1")).keys()).map((r) => new URL(r.url).pathname).sort());

test("set-up: a class with three published lessons", async () => {
  classId = await setUpClass(ctx);
  // Writing and publishing lessons is covered in the teaching tests; here they are put in place directly.
  const [{ courseId }] = await testDb('SELECT "courseId" FROM course_class WHERE id = $1', [classId]);
  await testDb(`INSERT INTO module (id, "courseId", title, sort) VALUES ('m-offline', $1, 'Week 1', 1)`, [courseId]);
  lessons = [
    ["l-one", "What is bookkeeping?", "Bookkeeping is the daily record of money coming in and going out."],
    ["l-two", "The cash book", "A cash book lists every payment received and every payment made."],
    ["l-three", "Receipts", "Keep a receipt for every sale so the cash book can be checked."],
  ];
  for (const [i, [id, title, body]] of lessons.entries()) {
    await testDb(
      `INSERT INTO lesson (id, "moduleId", title, kind, body, status, sort, "publishedAt", "updatedAt") VALUES ($1, 'm-offline', $2, 'ONLINE', $3, 'PUBLISHED', $4, now(), now())`,
      [id, title, body, i + 1],
    );
  }
});

test("the platform can be added to a phone's home screen", async () => {
  const page = await person(ctx);
  await page.goto(`${URL_BASE}/sign-in`);
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = await (await page.request.get(URL_BASE + href)).json();
  assert.equal(manifest.name, "TIME Learning");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/dashboard");
  for (const icon of manifest.icons) assert.equal((await page.request.get(URL_BASE + icon.src)).status(), 200, `${icon.src} exists`);
  assert.ok(manifest.icons.some((i) => i.purpose === "maskable"));
  assert.deepEqual(await (await page.request.get(`${URL_BASE}/api/health`)).json(), { ok: true });
  await page.context().close();
});

test("a lesson the student has opened can be read again with no connection", async () => {
  const ama = await as(ctx, PEOPLE.ama);
  await ama.goto(`${URL_BASE}/learn/${classId}`);
  await workerReady(ama);
  await ama.goto(`${URL_BASE}/learn/${classId}/l-one`);
  await ama.waitForFunction(async () => (await (await caches.open("time-pages-v1")).keys()).length > 0);

  await ama.context().setOffline(true);
  await ama.goto(`${URL_BASE}/learn/${classId}/l-one`);
  assert.match(await ama.locator(".lesson-body").innerText(), /daily record of money/);
  assert.match(await ama.locator(".offline-bar").innerText(), /no connection/);
  assert.equal(await ama.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(248, 248, 243)", "the saved page keeps its styles");

  // A lesson that was never opened, and pages that are never kept, show the offline page instead.
  await ama.goto(`${URL_BASE}/learn/${classId}/l-two`);
  assert.match(await ama.locator("h1").innerText(), /You have no connection/);
  await ama.goto(`${URL_BASE}/fees`);
  assert.match(await ama.locator("h1").innerText(), /You have no connection/);
  assert.deepEqual(ama.problems, []);
  await ama.context().close();
});

test("Save lessons for offline keeps the whole class on the phone", async () => {
  const ben = await as(ctx, PEOPLE.ben);
  await ben.goto(`${URL_BASE}/learn/${classId}`);
  await workerReady(ben);
  await ben.click('button:has-text("Save lessons for offline")');
  await ben.locator('p[role="status"]:has-text("All 3 lessons in this class can now be read")').waitFor();
  assert.deepEqual(await keptPages(ben), ["/my-classes", `/learn/${classId}`, ...lessons.map(([id]) => `/learn/${classId}/${id}`)].sort());

  await ben.context().setOffline(true);
  await ben.goto(`${URL_BASE}/my-classes`);
  await ben.click('a:has-text("Open class")');
  await ben.waitForURL(`**/learn/${classId}`);
  await ben.click('a:has-text("Receipts")');
  await ben.waitForURL("**/l-three");
  assert.match(await ben.locator(".lesson-body").innerText(), /Keep a receipt for every sale/);
  await ben.goto(`${URL_BASE}/learn/${classId}/l-two`);
  assert.match(await ben.locator(".lesson-body").innerText(), /cash book lists every payment/);

  // Back online, the server is asked first again, so changes show at once.
  await ben.context().setOffline(false);
  await testDb(`UPDATE lesson SET body = 'A cash book lists money in and money out, day by day.' WHERE id = 'l-two'`);
  await ben.goto(`${URL_BASE}/learn/${classId}/l-two`);
  assert.match(await ben.locator(".lesson-body").innerText(), /day by day/);
  assert.equal(await ben.locator(".offline-bar").count(), 0);
  await ben.context().close();
});

test("assessments are never kept, and signing out removes saved lessons from the phone", async () => {
  const ama = await as(ctx, PEOPLE.ama);
  await ama.goto(`${URL_BASE}/learn/${classId}`);
  await workerReady(ama);
  await ama.goto(`${URL_BASE}/learn/${classId}/l-two`);
  await ama.goto(`${URL_BASE}/learn/${classId}/assess/anything`);
  await ama.goto(`${URL_BASE}/fees`);
  await ama.goto(`${URL_BASE}/learn/${classId}/l-three`);
  await ama.waitForFunction(async () => (await (await caches.open("time-pages-v1")).keys()).some((r) => r.url.endsWith("/l-three")));
  const kept = await keptPages(ama);
  assert.ok(kept.every((p) => p === "/my-classes" || /^\/learn\/[^/]+(\/l-[a-z]+)?$/.test(p)), `only class and lesson pages are kept: ${kept}`);

  await submit(ama, 'button:has-text("Sign out")');
  await ama.waitForURL("**/sign-in");
  await ama.waitForFunction(async () => (await (await caches.open("time-pages-v1")).keys()).length === 0);
  await ama.context().setOffline(true);
  await ama.goto(`${URL_BASE}/learn/${classId}/l-two`);
  assert.match(await ama.locator("h1").innerText(), /You have no connection/);
  await ama.context().close();
});
