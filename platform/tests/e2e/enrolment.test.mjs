import { test } from "node:test";
import assert from "node:assert/strict";
import { ADMIN, URL_BASE, person, signIn, signUp, submit, useApp } from "./helpers.mjs";

const ctx = useApp();
const DESK = { width: 1280, height: 900 };
const registrar = { name: "Rita Registrar", email: "rita@example.test", password: "registrar-password-1" };
const lecturer = { name: "Leo Lecturer", email: "leo@example.test", password: "lecturer-password-1" };
const otherLecturer = { name: "Olu Lecturer", email: "olu@example.test", password: "lecturer-password-2" };
const ama = { name: "Ama Kollie", email: "ama@example.test", password: "student-password-1" };
const ben = { name: "Ben Dolo", email: "ben@example.test", password: "student-password-2" };
const year = new Date().getUTCFullYear();

// Create an account, then have the administrator give it a role.
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

let classUrl;

test("people are set up with their roles", async () => {
  await makeStaff(registrar, "REGISTRAR");
  await makeStaff(lecturer, "LECTURER");
  await makeStaff(otherLecturer, "LECTURER");
  for (const s of [ama, ben]) { const p = await person(ctx); await signUp(p, s); await p.context().close(); }
});

test("students and lecturers cannot open setup or class administration", async () => {
  for (const creds of [ama, lecturer]) {
    const page = await as(creds);
    for (const path of ["/admin/setup", "/admin/classes", "/admin/approvals"]) {
      await page.goto(URL_BASE + path);
      assert.equal(new URL(page.url()).pathname, "/dashboard", `${creds.name} ${path}`);
    }
    await page.context().close();
  }
});

test("the registrar adds a study centre and a class; bad setups are refused", async () => {
  const page = await as(registrar, DESK);
  await page.goto(`${URL_BASE}/admin/setup`);
  assert.match(await page.locator("table").first().innerText(), /March 2027[\s\S]*Planned/);
  await page.fill("#centre-name", "Margibi campus");
  await page.fill("#centre-county", "Margibi");
  await submit(page, 'button:has-text("Add study centre")');
  assert.match(await page.locator(".notice.ok").innerText(), /Margibi campus was added/);

  await page.goto(`${URL_BASE}/admin/classes`);
  await page.selectOption("#courseId", { label: "QuickBooks" });
  await page.selectOption("#intakeId", { label: "March 2027" });
  await page.selectOption("#track", "SATURDAY");
  await page.selectOption("#mode", "BLENDED");
  await submit(page, 'button:has-text("Add class")');
  assert.match(await page.locator(".notice.error").innerText(), /needs a study centre/);

  await page.selectOption("#courseId", { label: "QuickBooks" });
  await page.selectOption("#intakeId", { label: "March 2027" });
  await page.selectOption("#track", "SATURDAY");
  await page.selectOption("#studyCentreId", { label: "Margibi campus" });
  await page.fill("#capacity", "1");
  await submit(page, 'button:has-text("Add class")');
  await page.waitForURL(/\/admin\/classes\/.+/);
  classUrl = page.url().split("?")[0];
  assert.match(await page.locator("main").innerText(), /QuickBooks[\s\S]*March 2027 · Saturdays · Blended · Margibi campus · 0 of 1 enrolled/);

  await page.goto(`${URL_BASE}/admin/classes`);
  await page.selectOption("#courseId", { label: "QuickBooks" });
  await page.selectOption("#intakeId", { label: "March 2027" });
  await page.selectOption("#track", "SATURDAY");
  await page.selectOption("#studyCentreId", { label: "Margibi campus" });
  await submit(page, 'button:has-text("Add class")');
  assert.match(await page.locator(".notice.error").innerText(), /already exists/);
  await page.context().close();
});

test("students can apply only once the intake is open", async () => {
  const student = await as(ama);
  await student.goto(`${URL_BASE}/apply`);
  assert.match(await student.locator("main").innerText(), /No classes are taking applications/);

  const reg = await as(registrar, DESK);
  await reg.goto(`${URL_BASE}/admin/setup`);
  await submit(reg, 'tr:has-text("March 2027") button:has-text("Open for applications")');
  assert.match(await reg.locator(".notice.ok").innerText(), /opened for applications/);

  await student.goto(`${URL_BASE}/apply`);
  await student.selectOption("#classId", { index: 1 });
  await student.fill("#county", "Margibi");
  await student.fill("#work", "Grade 3 teacher");
  await submit(student, 'button:has-text("Send application")');
  assert.match(await student.locator(".notice.ok").innerText(), /has been sent/);
  assert.match(await student.locator("table").innerText(), /QuickBooks · March 2027 · Saturdays[\s\S]*Waiting/);
  assert.equal(await student.locator("#classId").count(), 0, "the class cannot be applied to twice");
  await student.context().close();
  await reg.context().close();
});

test("the registrar approves the application; the student is enrolled with a student number", async () => {
  const reg = await as(registrar, DESK);
  await reg.goto(`${URL_BASE}/admin/approvals`);
  const card = reg.locator("article");
  assert.equal(await card.count(), 1);
  assert.match(await card.innerText(), /Ama Kollie[\s\S]*Applies to QuickBooks · March 2027 · Saturdays \(lives in Margibi, works as Grade 3 teacher\)/);
  await submit(reg, 'button[value="APPROVED"]');
  assert.match(await reg.locator(".notice.ok").innerText(), /approved/);

  const student = await as(ama);
  await student.goto(`${URL_BASE}/my-classes`);
  const text = await student.locator("main").innerText();
  assert.ok(text.includes(`TIME-${year}-0001`), text);
  assert.match(text, /QuickBooks[\s\S]*Enrolled[\s\S]*Margibi campus/);
  await student.context().close();
  await reg.context().close();
});

test("a full class cannot take another student; the registrar rejects with a reason", async () => {
  const student = await as(ben);
  await student.goto(`${URL_BASE}/apply`);
  await student.selectOption("#classId", { index: 1 });
  await student.fill("#county", "Bong");
  await submit(student, 'button:has-text("Send application")');

  const reg = await as(registrar, DESK);
  await reg.goto(`${URL_BASE}/admin/approvals`);
  await submit(reg, 'button[value="APPROVED"]');
  assert.match(await reg.locator(".notice.error").innerText(), /class is full/);
  assert.equal(await reg.locator("article").count(), 1, "the request is still waiting");
  await reg.fill('input[name="note"]', "This class is full. Please apply for the October intake.");
  await submit(reg, 'button[value="REJECTED"]');

  await student.goto(`${URL_BASE}/apply`);
  assert.match(await student.locator("table").innerText(), /Rejected[\s\S]*October intake/);
  await student.goto(`${URL_BASE}/my-classes`);
  assert.match(await student.locator("main").innerText(), /not enrolled in a class yet/);
  await student.context().close();
  await reg.context().close();
});

test("a lecturer sees only the classes they are assigned to", async () => {
  const reg = await as(registrar, DESK);
  await reg.goto(classUrl);
  await reg.selectOption("#staff-user", { label: "Leo Lecturer · Lecturer" });
  await submit(reg, 'button:has-text("Assign")');
  assert.match(await reg.locator(".notice.ok").innerText(), /Leo Lecturer was assigned/);
  const classId = classUrl.split("/").pop();

  const leo = await as(lecturer, DESK);
  await leo.goto(`${URL_BASE}/teach`);
  assert.match(await leo.locator("a.tile").innerText(), /QuickBooks[\s\S]*1 student/);
  await leo.click("a.tile");
  await leo.waitForURL(`**/teach/${classId}`);
  assert.match(await leo.locator("table").innerText(), new RegExp(`Ama Kollie\\s+TIME-${year}-0001\\s+Margibi`));

  for (const creds of [otherLecturer, ama]) {
    const page = await as(creds);
    const response = await page.goto(`${URL_BASE}/teach/${classId}`);
    assert.equal(response.status(), 404, `${creds.name} is not assigned`);
    await page.context().close();
  }
  await leo.context().close();
  await reg.context().close();
});

test("a student asks to withdraw; the registrar approves and the class list shows it", async () => {
  const student = await as(ama);
  await student.goto(`${URL_BASE}/my-classes`);
  await student.click("summary");
  await student.selectOption("select[name=change]", "WITHDRAW");
  await student.fill("textarea[name=note]", "I am moving to another county this year.");
  await submit(student, 'button:has-text("Send request")');
  assert.match(await student.locator("main").innerText(), /request to withdraw is waiting/);

  const reg = await as(registrar, DESK);
  await reg.goto(`${URL_BASE}/admin/approvals`);
  assert.match(await reg.locator("article").innerText(), /Asks to withdraw from QuickBooks · March 2027 · Saturdays/);
  await submit(reg, 'button[value="APPROVED"]');
  await reg.goto(classUrl);
  assert.match(await reg.locator("table").last().innerText(), /Ama Kollie[\s\S]*Withdrawn/);
  assert.match(await reg.locator("main").innerText(), /0 of 1 enrolled/);

  await student.goto(`${URL_BASE}/my-classes`);
  assert.match(await student.locator("article").innerText(), /Withdrawn/);
  await student.context().close();
  await reg.context().close();
});

test("an administrator sets a new password; the old one stops working and the person is signed out", async () => {
  const student = await as(ama);
  await student.waitForURL("**/dashboard");

  const reg = await as(registrar, DESK);
  await reg.goto(`${URL_BASE}/admin/users?q=ama`);
  assert.equal(await reg.locator('a:has-text("New password")').count(), 0, "the registrar cannot reset passwords");
  await reg.context().close();

  const admin = await as(ADMIN, DESK);
  await admin.goto(`${URL_BASE}/admin/users?q=ama`);
  await admin.click('a:has-text("New password")');
  await admin.waitForURL(/\/password$/);
  await admin.fill("#password", "a-brand-new-password");
  await submit(admin, 'button:has-text("Set password")');
  assert.match(await admin.locator(".notice.ok").innerText(), /Ama Kollie has a new password/);

  await student.goto(`${URL_BASE}/dashboard`);
  assert.equal(new URL(student.url()).pathname, "/sign-in");
  await signIn(student, ama);
  assert.match(await student.locator(".notice.error").innerText(), /not correct/);
  await signIn(student, { ...ama, password: "a-brand-new-password" });
  await student.waitForURL("**/dashboard");
  await student.context().close();
  await admin.context().close();
});

test("every step is in the activity log, and the registrar's inbox shows only their own kinds of request", async () => {
  const admin = await as(ADMIN, DESK);
  await admin.goto(`${URL_BASE}/admin/activity`);
  const text = await admin.locator("table").innerText();
  for (const expected of [
    "Rita Registrar added the study centre Margibi campus, Margibi",
    "Rita Registrar created the class QuickBooks · March 2027 · Saturdays",
    "Rita Registrar opened for applications the March 2027 intake",
    "Ama Kollie applied to QuickBooks · March 2027 · Saturdays",
    "Rita Registrar approved the application request from Ama Kollie",
    `Ama Kollie (TIME-${year}-0001) was enrolled in QuickBooks, March 2027`,
    "Rita Registrar rejected the application request from Ben Dolo",
    "Rita Registrar assigned Leo Lecturer (Lecturer) to QuickBooks · March 2027 · Saturdays",
    "Ama Kollie asked to withdraw from QuickBooks · March 2027 · Saturdays",
    "Ama Kollie's enrolment was withdrawn",
    "Test Admin set a new password for Ama Kollie",
  ]) assert.ok(text.includes(expected), expected);
  assert.ok(!text.includes("a-brand-new-password"), "passwords never appear in the log");

  // A staff access request is for administrators, so the registrar must not see it.
  const ben2 = await as(ben);
  await ben2.goto(`${URL_BASE}/account/staff-access`);
  await ben2.selectOption("#role", "LECTURER");
  await ben2.fill("#note", "I would like to teach at TIME next year.");
  await submit(ben2, "form.form button[type=submit]");
  const reg = await as(registrar, DESK);
  await reg.goto(`${URL_BASE}/admin/approvals`);
  assert.equal(await reg.locator("article").count(), 0);
  await admin.goto(`${URL_BASE}/admin/approvals`);
  assert.equal(await admin.locator("article").count(), 1);
  assert.deepEqual(admin.problems, []);
  await ben2.context().close();
  await reg.context().close();
  await admin.context().close();
});
