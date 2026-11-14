import { test } from "node:test";
import assert from "node:assert/strict";
import { DESK, PEOPLE, URL_BASE, as, makeStaff, person, signUp, submit, testDb, useApp } from "./helpers.mjs";

const ctx = useApp();
const { registrar, dean } = PEOPLE;
const students = ["Ama Kollie", "Ben Dolo", "Cece Flomo", "Dee Kpan", "Eva Sirleaf"].map((name, i) => ({ name, email: `s${i}@example.test`, password: `student-password-${i}` }));

async function waitingApplications(page) {
  await page.goto(`${URL_BASE}/admin/approvals`);
  return page.locator('article:has-text("Application")').count();
}

test("set-up: a class with three places, and five students who apply to it", async () => {
  await makeStaff(ctx, registrar, "REGISTRAR");
  await makeStaff(ctx, dean, "LEADERSHIP");
  const reg = await as(ctx, registrar, DESK);
  await reg.goto(`${URL_BASE}/admin/classes`);
  await reg.selectOption("#courseId", { label: "QuickBooks" });
  await reg.selectOption("#intakeId", { label: "March 2027" });
  await reg.selectOption("#mode", "ONLINE");
  await reg.fill("#capacity", "3");
  await submit(reg, 'button:has-text("Add class")');
  await reg.waitForURL(/\/admin\/classes\/.+/);
  await reg.goto(`${URL_BASE}/admin/setup`);
  await submit(reg, 'tr:has-text("March 2027") button:has-text("Open for applications")');
  await reg.context().close();
  for (const s of students) {
    const page = await person(ctx);
    await signUp(page, s);
    await page.goto(`${URL_BASE}/apply`);
    await page.selectOption("#classId", { index: 1 });
    await page.fill("#county", "Margibi");
    await submit(page, 'button:has-text("Send application")');
    await page.context().close();
  }
  // One of them also asks for staff access, a request that must never be approved in a batch.
  const s = await as(ctx, students[3]);
  await s.goto(`${URL_BASE}/account/staff-access`);
  await s.selectOption("#role", "LECTURER");
  await s.fill("#note", "I also teach bookkeeping on Saturdays.");
  await submit(s, 'button:has-text("Send request")');
  await s.context().close();
});

test("a batch that includes anything but applications is refused as a whole", async () => {
  const [{ id }] = await testDb(`SELECT id FROM approval_request WHERE type = 'STAFF_ACCESS' AND status = 'PENDING'`);
  const reg = await as(ctx, registrar, DESK);
  await reg.goto(`${URL_BASE}/admin/approvals`);
  // Add the staff access request to the form, as someone editing the page could.
  await reg.evaluate((staffId) => {
    const input = Object.assign(document.createElement("input"), { type: "hidden", name: "allIds", value: staffId });
    document.getElementById("bulk-approve").append(input);
  }, id);
  await submit(reg, 'button:has-text("Approve all 5 applications")');
  await reg.locator(".notice.error", { hasText: "Only applications can be approved together" }).waitFor();
  const [{ n }] = await testDb("SELECT count(*)::int AS n FROM approval_request WHERE status <> 'PENDING'");
  assert.equal(n, 0, "nothing was decided");
  await reg.context().close();
});

test("the Registrar approves two ticked applications at once", async () => {
  const reg = await as(ctx, registrar, DESK);
  assert.equal(await waitingApplications(reg), 5);
  assert.match(await reg.locator("#bulk-approve").innerText(), /Approve all 5 applications/);
  await reg.check(`article:has-text("${students[0].name}") input[name="ids"]`);
  await reg.check(`article:has-text("${students[1].name}") input[name="ids"]`);
  await submit(reg, 'button:has-text("Approve ticked applications")');
  await reg.locator('.notice.ok', { hasText: "2 applications were approved." }).waitFor();
  assert.equal(await waitingApplications(reg), 3);
  const numbers = await testDb(`SELECT u."studentNumber" FROM enrolment e JOIN "user" u ON u.id = e."userId" ORDER BY u."studentNumber"`);
  assert.equal(numbers.length, 2);
  assert.ok(numbers.every((n) => /^TIME-\d{4}-\d{4}$/.test(n.studentNumber)), "each approved student gets a student number");

  await submit(reg, 'button:has-text("Approve ticked applications")');
  await reg.locator('.notice.error', { hasText: "Tick the applications to approve first." }).waitFor();
  await reg.context().close();
});

test("approving all: the class fills up, and the rest are reported, not squeezed in", async () => {
  const reg = await as(ctx, registrar, DESK);
  await reg.goto(`${URL_BASE}/admin/approvals`);
  await submit(reg, 'button:has-text("Approve all 3 applications")');
  await reg.locator('.notice.ok', { hasText: "1 application was approved. 2 could not be:" }).waitFor();
  assert.match(await reg.locator(".notice.ok").innerText(), /full/i);
  const [{ n }] = await testDb("SELECT count(*)::int AS n FROM enrolment");
  assert.equal(n, 3, "never more students than places");
  assert.equal(await waitingApplications(reg), 2, "the two that could not be approved are still waiting");
  // With applications still waiting, each can be rejected on its own with a reason.
  await reg.fill(`article:has-text("${students[4].name}") input[name="note"]`, "The class is full. Please apply to the October intake.");
  await submit(reg, `article:has-text("${students[4].name}") button[value="REJECTED"]`);
  await reg.locator('.notice.ok', { hasText: "Request rejected." }).waitFor();
  assert.equal(await waitingApplications(reg), 1);
  assert.equal(await reg.locator("#bulk-approve").count(), 0, "the bulk buttons appear only when two or more can be approved");
  await reg.context().close();
});

test("leadership sees applications but does not decide them, so has no bulk buttons", async () => {
  const dora = await as(ctx, dean, DESK);
  await dora.goto(`${URL_BASE}/admin/approvals`);
  assert.ok((await dora.locator('article:has-text("Application")').count()) >= 1);
  assert.equal(await dora.locator("#bulk-approve").count(), 0);
  assert.equal(await dora.locator('input[name="ids"]').count(), 0);
  await dora.context().close();
});

test("each approval in a batch is in the activity log, and each student is told", async () => {
  const rows = await testDb(`SELECT summary FROM audit_log WHERE action = 'approval.approved' ORDER BY "createdAt"`);
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => /^Rita Registrar approved the application request from /.test(r.summary)));
  const told = await testDb(`SELECT count(*)::int AS n FROM notification WHERE title = 'Application: approved'`);
  assert.equal(told[0].n, 3);
});
