import { test } from "node:test";
import assert from "node:assert/strict";
import { ADMIN, DESK, PEOPLE, URL_BASE, as, makeStaff, person, setUpClass, signUp, submit, useApp } from "./helpers.mjs";

const ctx = useApp();
const { lecturer, registrar, ama, ben } = PEOPLE;
const finance = { name: "Fiona Finance", email: "fiona@example.test", password: "finance-password-1" };
const cy = { name: "Cy Outsider", email: "cy@example.test", password: "student-password-3" };
const path = (page) => new URL(page.url()).pathname;
const status = async (page, p) => (await page.goto(URL_BASE + p)).status();
const unread = async (page) => (await page.locator('nav a[href="/notifications"] .pill').count()) ? Number((await page.locator('nav a[href="/notifications"] .pill').innerText()).match(/\d+/)[0]) : 0;

let classId, feesTicket;

test("a class is ready, with a finance officer and a student who is not in the class", async () => {
  classId = await setUpClass(ctx);
  await makeStaff(ctx, finance, "FINANCE");
  const p = await person(ctx); await signUp(p, cy); await p.context().close();
});

test("people are told what happened to them, and only to them", async () => {
  const student = await as(ctx, ama);
  assert.ok((await unread(student)) >= 2, "the application and the payment each produced a notification");
  await student.goto(`${URL_BASE}/notifications`);
  const text = await student.locator("main").innerText();
  assert.match(text, /Application: approved[\s\S]*was enrolled in QuickBooks, March 2027/);
  assert.match(text, /Payment recorded: US\$100/);
  assert.ok(!text.includes("Ben Dolo"), "another student's news is not shown");
  await submit(student, 'button:has-text("Mark all")');
  assert.equal(await unread(student), 0);
  await student.context().close();

  const outsider = await as(ctx, cy);
  assert.equal(await unread(outsider), 0);
  await outsider.context().close();
});

test("an announcement and a newly opened assessment reach every student in the class", async () => {
  const leo = await as(ctx, lecturer, DESK);
  await leo.goto(`${URL_BASE}/teach/${classId}`);
  await leo.fill("#ann-title", "First class on Monday");
  await leo.fill("#ann-body", "We start at 3 PM. Bring a notebook.");
  await submit(leo, 'button:has-text("Post announcement")');
  await leo.goto(`${URL_BASE}/teach/${classId}/assessments`);
  await leo.fill("#a-title", "Week 1 exercise");
  await leo.selectOption("#a-kind", "WRITTEN");
  await leo.fill("#a-max", "10");
  await leo.fill("#a-instructions", "Describe a cash book in your own words.");
  await submit(leo, 'button:has-text("Create assessment")');
  await leo.waitForURL(/\/assessments\/[^/?]+\?/);
  await submit(leo, 'button:has-text("Open to students")');
  await leo.context().close();

  for (const creds of [ama, ben]) {
    const student = await as(ctx, creds);
    await student.goto(`${URL_BASE}/notifications`);
    const text = await student.locator("main").innerText();
    assert.match(text, /QuickBooks: First class on Monday[\s\S]*Bring a notebook/);
    assert.match(text, /New assessment: Week 1 exercise/);
    await student.context().close();
  }
});

test("the class discussion is for the class only; the lecturer can remove a post", async () => {
  const student = await as(ctx, ama);
  await student.goto(`${URL_BASE}/learn/${classId}`);
  await student.click('a:has-text("Class discussion")');
  await student.waitForURL(`**/discussion/${classId}`);
  await student.fill("#new-post", "Is a cash book the same as a ledger?");
  await submit(student, 'button:has-text("Post question")');
  assert.match(await student.locator("article").innerText(), /Ama Kollie[\s\S]*Is a cash book the same as a ledger\?/);

  const leo = await as(ctx, lecturer, DESK);
  await leo.goto(`${URL_BASE}/notifications`);
  assert.match(await leo.locator("main").innerText(), /New question in QuickBooks[\s\S]*Ama Kollie: Is a cash book the same as a ledger\?/);
  await leo.goto(`${URL_BASE}/discussion/${classId}`);
  await leo.fill('article input[name="body"]', "Not quite. The cash book records only cash; the ledger holds every account.");
  await submit(leo, 'article button:has-text("Reply")');
  assert.match(await leo.locator("article").innerText(), /Leo Lecturer \(staff\)/);

  const classmate = await as(ctx, ben);
  await classmate.goto(`${URL_BASE}/discussion/${classId}`);
  assert.equal(await classmate.locator('button:has-text("Remove")').count(), 0, "students cannot remove posts");
  await classmate.fill('article input[name="body"]', "This reply is off topic and should be removed.");
  await submit(classmate, 'article button:has-text("Reply")');
  await classmate.context().close();

  await student.goto(`${URL_BASE}/notifications`);
  assert.match(await student.locator("main").innerText(), /Leo Lecturer replied to your question/);

  await leo.goto(`${URL_BASE}/discussion/${classId}`);
  await submit(leo, '.reply:has-text("off topic") button:has-text("Remove")');
  const thread = await leo.locator("article").innerText();
  assert.match(thread, /This reply was removed by the lecturer/);
  assert.ok(!thread.includes("off topic"));
  await leo.context().close();

  // People outside the class cannot read it.
  for (const creds of [cy, registrar, finance]) {
    const page = await as(ctx, creds);
    assert.equal(await status(page, `/discussion/${classId}`), 404, creds.name);
    await page.context().close();
  }
  await student.context().close();
});

test("a fees question goes to finance, not the registrar; replies go back and forth; nobody else can read it", async () => {
  const student = await as(ctx, ama);
  await student.goto(`${URL_BASE}/help`);
  await student.selectOption("#category", "FEES");
  await student.fill("#subject", "Receipt shows the wrong amount");
  await student.fill("#body", "I paid US$100 but I would like to check the receipt.");
  await submit(student, 'button:has-text("Send request")');
  await student.waitForURL(/\/help\/.+/);
  feesTicket = path(student);
  assert.match(await student.locator("main").innerText(), /Waiting for TIME/);

  const reg = await as(ctx, registrar, DESK);
  await reg.goto(`${URL_BASE}/admin/support`);
  assert.equal(await reg.locator("tbody a").count(), 0, "the registrar does not see fee questions");
  assert.equal(await status(reg, feesTicket), 404);
  await reg.context().close();
  const classmate = await as(ctx, ben);
  assert.equal(await status(classmate, feesTicket), 404);
  await classmate.context().close();

  const fiona = await as(ctx, finance, DESK);
  assert.ok((await unread(fiona)) >= 1);
  await fiona.goto(`${URL_BASE}/admin/support`);
  await fiona.click('tbody a:has-text("Receipt shows the wrong amount")');
  await fiona.waitForURL(/\/help\/.+/);
  assert.match(await fiona.locator("main").innerText(), /from Ama Kollie \(Student\), ama@example\.test/);
  await fiona.fill("#reply", "Your receipt R-000001 is for US$100. It is correct.");
  await submit(fiona, 'button:has-text("Send reply")');
  assert.match(await fiona.locator("main").innerText(), /Answered[\s\S]*Fiona Finance \(TIME office\)/);
  await fiona.context().close();

  await student.goto(`${URL_BASE}/notifications`);
  assert.match(await student.locator("main").innerText(), /Reply to your help request: Receipt shows the wrong amount/);
  await student.goto(URL_BASE + feesTicket);
  await submit(student, 'button:has-text("This is solved: close it")');
  assert.match(await student.locator("main").innerText(), /Closed/);

  // A question about the class goes to the registrar instead.
  await student.goto(`${URL_BASE}/help`);
  await student.selectOption("#category", "COURSE");
  await student.fill("#subject", "Which study centre do I attend?");
  await student.fill("#body", "I live in Bong County. Where are the practical sessions?");
  await submit(student, 'button:has-text("Send request")');
  const reg2 = await as(ctx, registrar, DESK);
  await reg2.goto(`${URL_BASE}/admin/support`);
  assert.equal(await reg2.locator('tbody a:has-text("Which study centre")').count(), 1);
  await reg2.context().close();
  const fiona2 = await as(ctx, finance, DESK);
  await fiona2.goto(`${URL_BASE}/admin/support`);
  assert.equal(await fiona2.locator("tbody a").count(), 0);
  await fiona2.context().close();
  await student.context().close();
});

test("a sponsor's report needs each student's consent, shows a summary only, and stops when consent is withdrawn", async () => {
  for (const creds of [lecturer, finance]) {
    const page = await as(ctx, creds);
    await page.goto(`${URL_BASE}/admin/sponsors`);
    assert.equal(path(page), "/dashboard", creds.name);
    await page.context().close();
  }
  const reg = await as(ctx, registrar, DESK);
  await reg.goto(`${URL_BASE}/admin/sponsors`);
  await reg.fill("#s-name", "Hope Church, Harbel");
  await reg.fill("#s-contact", "0770 000 111");
  await submit(reg, 'button:has-text("Add sponsor")');
  await reg.waitForURL(/\/admin\/sponsors\/.+/);
  const sponsorUrl = reg.url().split("?")[0];
  for (const name of ["Ama Kollie", "Ben Dolo"]) {
    await reg.selectOption("#enrolmentId", { label: `${name} · QuickBooks · March 2027 · Weekday afternoons` });
    await submit(reg, 'button:has-text("Link student")');
    await reg.locator(`.notice.ok:has-text("${name} is linked")`).waitFor();
  }
  assert.match(await reg.locator("main").innerText(), /No student has agreed yet, so no report can be produced/);
  assert.equal((await reg.goto(`${sponsorUrl}/report`)).status(), 200);
  assert.match(await reg.locator("article").first().innerText(), /No student has agreed[\s\S]*Not included, because consent has not been given: Ama Kollie, Ben Dolo/);

  // Ama agrees on the platform; Ben's signed paper form is recorded by the registrar.
  const student = await as(ctx, ama);
  await student.goto(`${URL_BASE}/notifications`);
  assert.match(await student.locator("main").innerText(), /Hope Church, Harbel is recorded as your sponsor/);
  await student.goto(`${URL_BASE}/my-classes`);
  await submit(student, 'button:has-text("I agree to share my progress")');
  assert.match(await student.locator(".notice.ok").innerText(), /can now receive a summary/);

  await reg.goto(sponsorUrl);
  await submit(reg, 'tr:has-text("Ben Dolo") button:has-text("Record consent")');
  assert.match(await reg.locator(".notice.error").innerText(), /Tick the box/);
  await reg.check('tr:has-text("Ben Dolo") input[name="signed"]');
  await submit(reg, 'tr:has-text("Ben Dolo") button:has-text("Record consent")');
  await reg.locator('.notice.ok:has-text("Consent recorded")').waitFor();
  assert.match(await reg.locator('tr:has-text("Ama Kollie")').innerText(), /Agreed[\s\S]*given by the student on the platform/);
  assert.match(await reg.locator('tr:has-text("Ben Dolo")').innerText(), /Agreed[\s\S]*signed form recorded by Rita Registrar/);

  await submit(reg, 'button:has-text("Produce report for 2 students")');
  await reg.waitForURL(/\/report/);
  const report = await reg.locator("article").first().innerText();
  assert.match(report, /Sponsor: Hope Church, Harbel[\s\S]*Prepared by: Rita Registrar/);
  assert.match(report, /Ama Kollie[\s\S]*Enrolment\s+Enrolled[\s\S]*Attendance\s+Not recorded yet[\s\S]*Assessments handed in\s+0 of 1[\s\S]*Overall result\s+Not published yet[\s\S]*Academic standing\s+In progress/);
  assert.match(report, /Ben Dolo/);
  assert.ok(!/US\$|Mobile Money|balance/i.test(report), "no financial details in a sponsor report");

  await student.goto(`${URL_BASE}/my-classes`);
  await submit(student, 'button:has-text("Withdraw my consent")');
  await reg.goto(`${sponsorUrl}/report`);
  const after = await reg.locator("article").first().innerText();
  assert.match(after, /Not included, because consent has not been given: Ama Kollie/);
  assert.ok(!/Ama Kollie[\s\S]*Enrolment\s+Enrolled[\s\S]*Ben Dolo/.test(after), "Ama's progress is no longer in the report");
  await student.context().close();
  await reg.context().close();
});

test("discussions, help requests and sponsor actions are all in the activity log", async () => {
  const admin = await as(ctx, ADMIN, DESK);
  await admin.goto(`${URL_BASE}/admin/activity`);
  const text = await admin.locator("table").innerText();
  for (const expected of [
    "Ama Kollie asked a question in the discussion for QuickBooks · March 2027 · Weekday afternoons",
    "Leo Lecturer removed a post by Ben Dolo from a class discussion",
    "Ama Kollie asked for help: Receipt shows the wrong amount (Fees and payments)",
    'Fiona Finance replied to the help request "Receipt shows the wrong amount" from Ama Kollie',
    "Rita Registrar added the sponsor Hope Church, Harbel",
    "Ama Kollie agreed to share a progress summary with Hope Church, Harbel",
    "Rita Registrar recorded Ben Dolo's signed consent to share progress with Hope Church, Harbel",
    "Rita Registrar produced a progress report for Hope Church, Harbel covering Ama Kollie, Ben Dolo",
    "Ama Kollie withdrew consent to share a progress summary with Hope Church, Harbel",
  ]) assert.ok(text.includes(expected), expected);
  // An administrator can step into any class discussion and any help request.
  assert.equal(await status(admin, `/discussion/${classId}`), 200);
  assert.equal(await status(admin, feesTicket), 200);
  assert.deepEqual(admin.problems, []);
  await admin.context().close();
});
