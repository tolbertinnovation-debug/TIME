import { test } from "node:test";
import assert from "node:assert/strict";
import { ADMIN, URL_BASE, person, signIn, signUp, submit, useApp } from "./helpers.mjs";

const ctx = useApp();
const ama = { name: "Ama Kollie", email: "ama@example.test", password: "student-password-1" };
const joe = { name: "Joseph Toe", email: "joe@example.test", password: "student-password-2" };

test("signed-out visitors are sent to sign in", async () => {
  const page = await person(ctx);
  for (const path of ["/dashboard", "/admin", "/admin/activity", "/catalogue"]) {
    await page.goto(URL_BASE + path);
    assert.equal(new URL(page.url()).pathname, "/sign-in", path);
  }
  await page.context().close();
});

test("sign-up checks the form, creates a student account and refuses a duplicate email", async () => {
  const page = await person(ctx);
  await signUp(page, { ...ama, password: "short" }, { send: false });
  // The browser's own minimum-length check stops a short password before it is sent.
  assert.equal(new URL(page.url()).pathname, "/sign-up");
  await signUp(page, ama);
  await page.waitForURL("**/dashboard");
  assert.match(await page.locator("main").innerText(), /signed in as Student/);
  assert.equal(await page.locator('a[href="/admin"]').count(), 0, "students see no Administration link");
  assert.deepEqual(page.problems, []);

  const other = await person(ctx);
  await signUp(other, { ...ama, name: "Someone Else" });
  assert.match(await other.locator(".notice.error").innerText(), /already exists/);
  await page.context().close();
  await other.context().close();
});

test("a student cannot open the administration area", async () => {
  const page = await person(ctx);
  await signIn(page, ama);
  for (const path of ["/admin", "/admin/users", "/admin/approvals", "/admin/activity"]) {
    await page.goto(URL_BASE + path);
    assert.equal(new URL(page.url()).pathname, "/dashboard", path);
    assert.match(await page.locator(".notice.error").innerText(), /does not allow/);
  }
  await page.context().close();
});

test("the catalogue lists TIME's four schools and 41 courses", async () => {
  const page = await person(ctx);
  await signIn(page, ama);
  await page.goto(`${URL_BASE}/catalogue`);
  assert.equal(await page.locator("details.school").count(), 4);
  assert.equal(await page.locator("details.school li").count(), 41);
  await page.context().close();
});

test("a staff access request is approved by an administrator and takes effect at once", async () => {
  const student = await person(ctx);
  await signIn(student, ama);
  await student.goto(`${URL_BASE}/account/staff-access`);
  await student.selectOption("#role", "LECTURER");
  await student.fill("#note", "I teach Early Childhood Education on Saturdays.");
  await submit(student, "form.form button[type=submit]");
  assert.match(await student.locator(".notice.ok").innerText(), /has been sent/);
  assert.equal(await student.locator("#role").count(), 0, "no second request while one is waiting");

  const admin = await person(ctx, { width: 1280, height: 900 });
  await signIn(admin, ADMIN);
  await admin.waitForURL("**/dashboard");
  assert.match(await admin.locator('a.tile[href="/admin/approvals"]').innerText(), /^1\b/);
  await admin.goto(`${URL_BASE}/admin/approvals`);
  assert.match(await admin.locator("article").innerText(), /Ama Kollie[\s\S]*Lecturer role/);
  await submit(admin, 'button[value="APPROVED"]');
  assert.match(await admin.locator(".notice.ok").innerText(), /approved/);
  assert.equal(await admin.locator("article").count(), 0);

  await student.goto(`${URL_BASE}/dashboard`);
  assert.match(await student.locator("main").innerText(), /signed in as Lecturer/);
  await student.context().close();
  await admin.context().close();
});

test("rejecting needs a reason, and the reason is shown to the person who asked", async () => {
  const applicant = await person(ctx);
  await signUp(applicant, joe);
  await applicant.waitForURL("**/dashboard");
  await applicant.goto(`${URL_BASE}/account/staff-access`);
  await applicant.selectOption("#role", "FINANCE");
  await applicant.fill("#note", "I would like to see the finance screens.");
  await submit(applicant, "form.form button[type=submit]");

  const admin = await person(ctx, { width: 1280, height: 900 });
  await signIn(admin, ADMIN);
  await admin.goto(`${URL_BASE}/admin/approvals`);
  await submit(admin, 'button[value="REJECTED"]');
  assert.match(await admin.locator(".notice.error").innerText(), /reason/);
  await admin.fill('input[name="note"]', "Finance access is for TIME finance staff only.");
  await submit(admin, 'button[value="REJECTED"]');
  assert.match(await admin.locator(".notice.ok").innerText(), /rejected/);

  await applicant.goto(`${URL_BASE}/account/staff-access`);
  assert.match(await applicant.locator("table").innerText(), /Rejected[\s\S]*finance staff only/);
  await applicant.goto(`${URL_BASE}/dashboard`);
  assert.match(await applicant.locator("main").innerText(), /signed in as Student/);
  await applicant.context().close();
  await admin.context().close();
});

test("an administrator changes a role; a registrar sees accounts but cannot change them or see activity", async () => {
  const admin = await person(ctx, { width: 1280, height: 900 });
  await signIn(admin, ADMIN);
  await admin.goto(`${URL_BASE}/admin/users?q=joe`);
  assert.equal(await admin.locator("tbody tr").count(), 1);
  await admin.selectOption("tbody select[name=role]", "REGISTRAR");
  await submit(admin, 'tbody button:has-text("Save")');
  assert.match(await admin.locator(".notice.ok").innerText(), /Joseph Toe is now Registrar/);
  // An administrator has no controls on their own row
  await admin.goto(`${URL_BASE}/admin/users?q=admin@`);
  assert.equal(await admin.locator("tbody select, tbody button").count(), 0);

  const registrar = await person(ctx, { width: 1280, height: 900 });
  await signIn(registrar, joe);
  await registrar.goto(`${URL_BASE}/admin/users`);
  assert.equal(new URL(registrar.url()).pathname, "/admin/users");
  assert.equal(await registrar.locator("tbody select, tbody button").count(), 0, "read-only for the registrar");
  for (const path of ["/admin/activity", "/admin/approvals"]) {
    await registrar.goto(URL_BASE + path);
    assert.equal(new URL(registrar.url()).pathname, "/dashboard", path);
  }
  await admin.context().close();
  await registrar.context().close();
});

test("suspending signs the person out at once and blocks sign-in until restored", async () => {
  const joePage = await person(ctx);
  await signIn(joePage, joe);
  await joePage.waitForURL("**/dashboard");

  const admin = await person(ctx, { width: 1280, height: 900 });
  await signIn(admin, ADMIN);
  await admin.goto(`${URL_BASE}/admin/users?q=joe`);
  await submit(admin, 'tbody button:has-text("Suspend")');
  assert.match(await admin.locator(".notice.ok").innerText(), /suspended/);

  await joePage.goto(`${URL_BASE}/dashboard`);
  assert.equal(new URL(joePage.url()).pathname, "/sign-in");
  await signIn(joePage, joe);
  assert.match(await joePage.locator(".notice.error").innerText(), /suspended/);

  await admin.goto(`${URL_BASE}/admin/users?q=joe`);
  await submit(admin, 'tbody button:has-text("Restore")');
  await signIn(joePage, joe);
  await joePage.waitForURL("**/dashboard");
  await joePage.context().close();
  await admin.context().close();
});

test("five wrong passwords lock sign-in for that email", async () => {
  const page = await person(ctx);
  for (let i = 0; i < 5; i++) {
    await signIn(page, { email: ama.email, password: "wrong-password" });
    assert.match(await page.locator(".notice.error").innerText(), /not correct/);
  }
  await signIn(page, ama);
  assert.match(await page.locator(".notice.error").innerText(), /Too many failed attempts/);
  await page.context().close();
});

test("the activity log shows every action, with who did it, and can be filtered", async () => {
  const admin = await person(ctx, { width: 1280, height: 900 });
  await signIn(admin, ADMIN);
  await admin.goto(`${URL_BASE}/admin/activity`);
  const text = await admin.locator("table").innerText();
  for (const expected of [
    "Ama Kollie created an account",
    "Ama Kollie asked for Lecturer access",
    "Test Admin approved the staff access request from Ama Kollie",
    "Test Admin rejected the staff access request from Joseph Toe",
    "Test Admin changed Joseph Toe from Student to Registrar",
    "Test Admin suspended the account of Joseph Toe",
    "Test Admin restored the account of Joseph Toe",
    "Failed sign-in for ama@example.test",
  ]) assert.ok(text.includes(expected), expected);

  await admin.selectOption("#group", "approval");
  await admin.click('form[role=search] button');
  await admin.waitForURL(/group=approval/);
  const kinds = await admin.locator("tbody code").allInnerTexts();
  assert.ok(kinds.length >= 4 && kinds.every((k) => k.startsWith("approval.")), kinds.join(","));
  assert.deepEqual(admin.problems, []);
  await admin.context().close();
});
