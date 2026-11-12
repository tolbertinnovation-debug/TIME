import { test } from "node:test";
import assert from "node:assert/strict";
import { ADMIN, URL_BASE, person, signIn, signUp, submit, useApp } from "./helpers.mjs";

const ctx = useApp();
const DESK = { width: 1280, height: 900 };
const registrar = { name: "Rita Registrar", email: "rita@example.test", password: "registrar-password-1" };
const lecturer = { name: "Leo Lecturer", email: "leo@example.test", password: "lecturer-password-1" };
const facilitator = { name: "Fay Facilitator", email: "fay@example.test", password: "facilitator-password-1" };
const dean = { name: "Dora Dean", email: "dora@example.test", password: "leadership-password-1" };
const ama = { name: "Ama Kollie", email: "ama@example.test", password: "student-password-1" };
const ben = { name: "Ben Dolo", email: "ben@example.test", password: "student-password-2" };
const cy = { name: "Cy Outsider", email: "cy@example.test", password: "student-password-3" };

async function makeStaff(creds, role) {
  const page = await person(ctx);
  await signUp(page, creds);
  await page.context().close();
  const admin = await person(ctx, DESK);
  await signIn(admin, ADMIN);
  await admin.goto(`${URL_BASE}/admin/users?q=${encodeURIComponent(creds.email)}`);
  await admin.selectOption("tbody select[name=role]", role);
  await submit(admin, 'tbody button:has-text("Save")');
  await admin.context().close();
}
async function as(creds, viewport) {
  const page = await person(ctx, viewport);
  await signIn(page, creds);
  return page;
}
const status = async (page, path) => (await page.goto(URL_BASE + path)).status();

let classId, onlineLesson, practicalLesson;

test("a class is set up with a lecturer, a facilitator and two enrolled students", async () => {
  await makeStaff(registrar, "REGISTRAR");
  await makeStaff(lecturer, "LECTURER");
  await makeStaff(facilitator, "FACILITATOR");
  await makeStaff(dean, "LEADERSHIP");
  for (const s of [ama, ben, cy]) { const p = await person(ctx); await signUp(p, s); await p.context().close(); }

  const reg = await as(registrar, DESK);
  await reg.goto(`${URL_BASE}/admin/classes`);
  await reg.selectOption("#courseId", { label: "QuickBooks" });
  await reg.selectOption("#intakeId", { label: "March 2027" });
  await reg.selectOption("#mode", "ONLINE");
  await submit(reg, 'button:has-text("Add class")');
  await reg.waitForURL(/\/admin\/classes\/.+/);
  classId = reg.url().split("?")[0].split("/").pop();
  for (const [name, role] of [["Leo Lecturer", "Lecturer"], ["Fay Facilitator", "Study centre facilitator"]]) {
    await reg.selectOption("#staff-user", { label: `${name} · ${role}` });
    await submit(reg, 'button:has-text("Assign")');
    // Wait for the page to show the result before choosing the next person.
    await reg.locator(`.notice.ok:has-text("${name} was assigned")`).waitFor();
  }
  await reg.goto(`${URL_BASE}/admin/setup`);
  await submit(reg, 'tr:has-text("March 2027") button:has-text("Open for applications")');

  for (const s of [ama, ben]) {
    const page = await as(s);
    await page.goto(`${URL_BASE}/apply`);
    await page.selectOption("#classId", { index: 1 });
    await page.fill("#county", "Margibi");
    await submit(page, 'button:has-text("Send application")');
    await page.context().close();
  }
  await reg.goto(`${URL_BASE}/admin/approvals`);
  // Approve both applications, waiting for the list to shrink after each decision.
  for (const left of [1, 0]) {
    await submit(reg, 'article >> nth=0 >> button[value="APPROVED"]');
    await reg.waitForFunction((n) => document.querySelectorAll("article").length === n, left);
  }
  await reg.context().close();
});

test("the lecturer writes lessons; students cannot see drafts; a facilitator cannot write lessons", async () => {
  const leo = await as(lecturer, DESK);
  await leo.goto(`${URL_BASE}/teach/${classId}/content`);
  await leo.fill("#module-title", "Week 1: Getting started");
  await submit(leo, 'button:has-text("Add module")');
  for (const [title, kind, body] of [
    ["What is bookkeeping?", "ONLINE", "Bookkeeping is the daily record of money coming in and going out.\n\nA business that keeps good records can see what it owes and what it is owed."],
    ["Set up a company file", "PRACTICAL", "At the study centre, create a company file for a small shop and enter its opening balances."],
  ]) {
    await leo.click('a:has-text("Write a lesson")');
    await leo.waitForURL(/content\/new/);
    await leo.fill("#title", title);
    await leo.selectOption("#kind", kind);
    await leo.fill("#body", body);
    await submit(leo, 'button:has-text("Save draft")');
    assert.match(await leo.locator(".notice.ok").innerText(), /saved as a draft/);
  }
  const links = await leo.locator('a:has-text("Edit")').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  [onlineLesson, practicalLesson] = links.map((h) => h.split("/").pop());

  const student = await as(ama);
  await student.goto(`${URL_BASE}/learn/${classId}`);
  assert.match(await student.locator("main").innerText(), /has not published lessons yet/);
  assert.equal(await status(student, `/learn/${classId}/${onlineLesson}`), 404, "a draft lesson cannot be opened");
  await student.context().close();

  const fay = await as(facilitator, DESK);
  assert.equal(await status(fay, `/teach/${classId}/content`), 404);
  assert.equal(await status(fay, `/teach/${classId}/sessions`), 200);
  await fay.context().close();
  await leo.context().close();
});

test("lessons are reviewed by academic leadership: rejected with a reason, fixed, then published", async () => {
  const leo = await as(lecturer, DESK);
  await leo.goto(`${URL_BASE}/teach/${classId}/content`);
  await submit(leo, 'button:has-text("Send 2 draft lessons for review")');
  assert.match(await leo.locator(".notice.ok").innerText(), /2 lessons were sent for review/);
  assert.equal(await leo.locator('a:has-text("Edit")').count(), 0, "lessons are locked during review");

  const reg = await as(registrar, DESK);
  await reg.goto(`${URL_BASE}/admin/approvals`);
  assert.equal(await reg.locator("article").count(), 0, "the registrar does not review lessons");
  await reg.context().close();

  const dora = await as(dean, DESK);
  await dora.goto(`${URL_BASE}/admin/approvals`);
  assert.match(await dora.locator("article").innerText(), /Leo Lecturer[\s\S]*Asks to publish 2 lessons in QuickBooks/);
  await dora.click('a:has-text("Read the lessons before deciding")');
  await dora.waitForURL(/\/admin\/content\//);
  assert.match(await dora.locator("main").innerText(), /daily record of money coming in and going out/);
  await dora.goto(`${URL_BASE}/admin/approvals`);
  await dora.fill('input[name="note"]', "Please add an example to the first lesson.");
  await submit(dora, 'button[value="REJECTED"]');

  await leo.goto(`${URL_BASE}/teach/${classId}/content`);
  assert.equal(await leo.locator('span.pill:has-text("Draft")').count(), 2);
  await leo.click(`a[href$="/content/${onlineLesson}"]`);
  await leo.waitForURL(new RegExp(onlineLesson));
  await leo.fill("#body", "Bookkeeping is the daily record of money coming in and going out.\n\nExample: a shop sells rice for LRD 500 and writes the sale in its cash book the same day.");
  await submit(leo, 'button:has-text("Save draft")');
  await submit(leo, 'button:has-text("Send 2 draft lessons for review")');

  await dora.goto(`${URL_BASE}/admin/approvals`);
  await submit(dora, 'button[value="APPROVED"]');
  assert.match(await dora.locator(".notice.ok").innerText(), /approved/);
  await leo.goto(`${URL_BASE}/teach/${classId}/content`);
  assert.equal(await leo.locator('span.pill:has-text("Published")').count(), 2);
  await leo.context().close();
  await dora.context().close();
});

test("a student studies an online lesson and marks it complete; practical work is not theirs to tick", async () => {
  const student = await as(ama);
  await student.goto(`${URL_BASE}/my-classes`);
  await student.click('a:has-text("Open class")');
  await student.waitForURL(`**/learn/${classId}`);
  assert.match(await student.locator("main").innerText(), /0%[\s\S]*Online 0 of 1[\s\S]*Practical 0 of 1/);
  await student.click('a:has-text("Continue: What is bookkeeping?")');
  await student.waitForURL(new RegExp(onlineLesson));
  assert.match(await student.locator(".lesson-body").innerText(), /a shop sells rice for LRD 500/);
  await submit(student, 'button:has-text("Mark lesson complete")');
  assert.match(await student.locator("main").innerText(), /50%[\s\S]*Online 1 of 1[\s\S]*Practical 0 of 1/);

  await student.goto(`${URL_BASE}/learn/${classId}/${practicalLesson}`);
  assert.equal(await student.locator('button:has-text("Mark lesson complete")').count(), 0);
  assert.match(await student.locator("main").innerText(), /facilitator signs it off/);
  await student.context().close();

  const outsider = await as(cy);
  assert.equal(await status(outsider, `/learn/${classId}`), 404, "a student who is not enrolled cannot open the class");
  assert.equal(await status(outsider, `/learn/${classId}/${onlineLesson}`), 404);
  await outsider.context().close();
});

test("the facilitator signs off practical work, and the student sees who signed it", async () => {
  const fay = await as(facilitator, DESK);
  await fay.goto(`${URL_BASE}/teach/${classId}`);
  assert.equal(await fay.locator("#ann-title").count(), 0, "a facilitator cannot post announcements");
  await fay.click('a:has-text("Sign off students")');
  await fay.waitForURL(/practical/);
  await fay.check('tr:has-text("Ama Kollie") input[type=checkbox]');
  await submit(fay, 'button:has-text("Save sign-off")');
  assert.match(await fay.locator('tr:has-text("Ama Kollie")').innerText(), /Fay Facilitator/);
  await fay.context().close();

  const student = await as(ama);
  await student.goto(`${URL_BASE}/learn/${classId}`);
  assert.match(await student.locator("main").innerText(), /100%[\s\S]*Practical 1 of 1/);
  await student.goto(`${URL_BASE}/learn/${classId}/${practicalLesson}`);
  assert.match(await student.locator(".notice.ok").innerText(), /Signed off by Fay Facilitator/);
  await student.context().close();
});

test("the lecturer schedules a session, takes attendance and posts an announcement", async () => {
  const leo = await as(lecturer, DESK);
  await leo.goto(`${URL_BASE}/teach/${classId}/sessions`);
  await leo.fill("#s-title", "Week 1 live class");
  await leo.fill("#s-when", "2030-01-15T10:00");
  await submit(leo, 'button:has-text("Add session")');
  assert.match(await leo.locator(".notice.error").innerText(), /needs its meeting link/);
  await leo.fill("#s-title", "Week 1 live class");
  await leo.fill("#s-when", "2030-01-15T10:00");
  await leo.fill("#s-url", "https://meet.jit.si/time-quickbooks-week1");
  await submit(leo, 'button:has-text("Add session")');

  await leo.click('a:has-text("Take attendance")');
  await leo.waitForURL(/sessions\/.+/);
  await leo.check('tr:has-text("Ama Kollie") input[value="PRESENT"]');
  await leo.check('tr:has-text("Ben Dolo") input[value="ABSENT"]');
  await submit(leo, 'button:has-text("Save attendance")');
  assert.match(await leo.locator(".notice.ok").innerText(), /1 of 2 present/);

  await leo.goto(`${URL_BASE}/teach/${classId}`);
  assert.match(await leo.locator('tr:has-text("Ama Kollie")').innerText(), /1 of 1\s+1 of 1\s+100%/);
  assert.match(await leo.locator('tr:has-text("Ben Dolo")').innerText(), /0 of 1\s+0 of 1\s+0%/);
  await leo.fill("#ann-title", "Welcome to QuickBooks");
  await leo.fill("#ann-body", "Our first live class is on 15 January. Please read lesson 1 before it.");
  await submit(leo, 'button:has-text("Post announcement")');
  await leo.context().close();

  const student = await as(ama);
  await student.goto(`${URL_BASE}/learn/${classId}`);
  const text = await student.locator("main").innerText();
  assert.match(text, /Attendance: 100% of sessions/);
  assert.match(text, /Welcome to QuickBooks[\s\S]*Leo Lecturer/);
  assert.equal(await student.locator('a:has-text("Join")').getAttribute("href"), "https://meet.jit.si/time-quickbooks-week1");
  await student.context().close();
});

test("a lesson taken back to draft disappears for students at once", async () => {
  const leo = await as(lecturer, DESK);
  await leo.goto(`${URL_BASE}/teach/${classId}/content`);
  await submit(leo, 'tr:has-text("What is bookkeeping?") button:has-text("Take back to draft")');
  await leo.context().close();

  const student = await as(ben);
  await student.goto(`${URL_BASE}/learn/${classId}`);
  assert.equal(await student.locator('a:has-text("What is bookkeeping?")').count(), 0);
  assert.equal(await status(student, `/learn/${classId}/${onlineLesson}`), 404);
  await student.context().close();
});

test("an administrator can step in on any class, and every action is in the activity log", async () => {
  const admin = await as(ADMIN, DESK);
  assert.equal(await status(admin, `/teach/${classId}/content`), 200);
  await admin.goto(`${URL_BASE}/admin/activity`);
  const text = await admin.locator("table").innerText();
  for (const expected of [
    'Leo Lecturer added the module "Week 1: Getting started" to QuickBooks',
    'Leo Lecturer wrote the lesson "What is bookkeeping?" in QuickBooks',
    "Leo Lecturer sent 2 lessons in QuickBooks for review",
    "Dora Dean rejected the lessons to publish request from Leo Lecturer",
    "Dora Dean approved the lessons to publish request from Leo Lecturer",
    "2 lessons were published in QuickBooks",
    'Ama Kollie completed the lesson "What is bookkeeping?" in QuickBooks',
    'Fay Facilitator updated sign-off for the practical "Set up a company file"',
    'Leo Lecturer scheduled "Week 1 live class"',
    'Leo Lecturer recorded attendance for "Week 1 live class"',
    'Leo Lecturer posted "Welcome to QuickBooks"',
    'Leo Lecturer took the lesson "What is bookkeeping?" in QuickBooks back to draft',
  ]) assert.ok(text.includes(expected), expected);
  assert.deepEqual(admin.problems, []);
  await admin.context().close();
});
