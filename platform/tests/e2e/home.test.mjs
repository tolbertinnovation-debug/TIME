import { test } from "node:test";
import assert from "node:assert/strict";
import { PEOPLE, DESK, URL_BASE, as, setUpClass, submit, testDb, useApp } from "./helpers.mjs";

const ctx = useApp();
const { ama, ben, lecturer } = PEOPLE;
let classId;

test("set-up: a class with three lessons, a session in two days, written work due in three, and Ben's work handed in", async () => {
  classId = await setUpClass(ctx);
  const [{ courseId }] = await testDb('SELECT "courseId" FROM course_class WHERE id = $1', [classId]);
  await testDb(`INSERT INTO module (id, "courseId", title, sort) VALUES ('m-home', $1, 'Week 1', 1)`, [courseId]);
  for (const [i, [id, title]] of [["h-one", "What is bookkeeping?"], ["h-two", "The cash book"], ["h-three", "Receipts"]].entries()) {
    await testDb(`INSERT INTO lesson (id, "moduleId", title, kind, body, status, sort, minutes, "publishedAt", "updatedAt") VALUES ($1, 'm-home', $2, 'ONLINE', 'Lesson text.', 'PUBLISHED', $3, 20, now(), now())`, [id, title, i + 1]);
  }
  await testDb(`INSERT INTO class_session (id, "classId", title, kind, "startsAt", "meetingUrl") VALUES ('s-home', $1, 'Live class: week 1', 'ONLINE', now() + interval '2 days', 'https://meet.example.test/week1')`, [classId]);
  await testDb(`INSERT INTO assessment (id, "classId", title, category, kind, instructions, "maxScore", "dueAt", status) VALUES ('a-home', $1, 'Cash book exercise', 'ASSIGNMENT', 'WRITTEN', 'Write up one week of sales.', 20, now() + interval '3 days', 'OPEN')`, [classId]);
  await testDb(`INSERT INTO submission (id, "assessmentId", "enrolmentId", text, "submittedAt") SELECT 'sub-ben', 'a-home', e.id, 'My cash book.', now() FROM enrolment e JOIN "user" u ON u.id = e."userId" WHERE u.email = $1`, [ben.email]);
});

test("a student's home page shows the next lesson, work to hand in and the coming session", async () => {
  const page = await as(ctx, ama);
  const text = await page.locator("section:has(#learning-h)").innerText();
  assert.match(text, /QuickBooks\s+0%/);
  assert.match(text, /NEXT LESSON\s+What is bookkeeping\? · 20 min/i);
  assert.match(text, /TO HAND IN\s+Cash book exercise[\s\S]*Due in 3 days/i);
  assert.match(text, /COMING SESSIONS\s+Live class: week 1[\s\S]*in 2 days/i);
  assert.equal(await page.locator('section:has(#learning-h) a:has-text("Join")').getAttribute("href"), "https://meet.example.test/week1");

  await page.click('section:has(#learning-h) a:has-text("Continue")');
  await page.waitForURL("**/h-one");
  await submit(page, 'button:has-text("Mark lesson complete")');
  await page.goto(`${URL_BASE}/dashboard`);
  assert.match(await page.locator("section:has(#learning-h)").innerText(), /33%[\s\S]*NEXT LESSON\s+The cash book/i);
  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test("work already handed in leaves the list; a class waiting for fees shows no lessons", async () => {
  const page = await as(ctx, ben);
  const text = await page.locator("section:has(#learning-h)").innerText();
  assert.ok(!/TO HAND IN/i.test(text), "Ben has handed the work in");
  await page.context().close();

  // Move Ben's first payment back nine weeks: the balance is overdue and the class is paused.
  await testDb(`UPDATE payment SET "paidOn" = current_date - 63 WHERE "enrolmentId" IN (SELECT e.id FROM enrolment e JOIN "user" u ON u.id = e."userId" WHERE u.email = $1)`, [ben.email]);
  const paused = await as(ctx, ben);
  const now = await paused.locator("section:has(#learning-h)").innerText();
  assert.match(now, /This class opens when your fees allow it/);
  assert.ok(!/NEXT LESSON|COMING SESSIONS/i.test(now), "nothing of a paused class is shown");
  await paused.context().close();
});

test("lessons have Previous and Next buttons in course order", async () => {
  const page = await as(ctx, ama);
  await page.goto(`${URL_BASE}/learn/${classId}/h-two`);
  const nav = page.locator("nav.lesson-nav");
  assert.match(await nav.innerText(), /Previous lesson\s+What is bookkeeping\?[\s\S]*Lesson 2 of 3[\s\S]*Next lesson ›\s+Receipts/);
  await nav.locator("a.next").click();
  await page.waitForURL("**/h-three");
  assert.equal(await page.locator("nav.lesson-nav a.next").count(), 0, "the last lesson has no Next");
  await page.locator("nav.lesson-nav a").first().click();
  await page.waitForURL("**/h-two");
  await page.goto(`${URL_BASE}/learn/${classId}/h-one`);
  assert.equal(await page.locator('nav.lesson-nav a:has-text("Previous")').count(), 0, "the first lesson has no Previous");
  await page.context().close();
});

test("a lecturer's home page shows work waiting to be marked and the coming session", async () => {
  const leo = await as(ctx, lecturer, DESK);
  const text = await leo.locator("section:has(#teaching-h)").innerText();
  assert.match(text, /QuickBooks\s+2 students/);
  assert.match(text, /TO MARK\s+1 piece of work is waiting for a mark/i);
  assert.match(text, /Live class: week 1/);
  await leo.click('section:has(#teaching-h) a:has-text("Mark work")');
  await leo.waitForURL(`**/teach/${classId}/assessments`);
  assert.equal(await leo.locator("#learning-h").count(), 0);
  await leo.context().close();
});
