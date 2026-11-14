import { test } from "node:test";
import assert from "node:assert/strict";
import { ADMIN, DESK, PEOPLE, URL_BASE, as, person, setUpClass, submit, testDb, useApp } from "./helpers.mjs";

const ctx = useApp();
const { lecturer, dean, registrar, ama, ben } = PEOPLE;
const path = (page) => new URL(page.url()).pathname;

let classId, certUrl, code;

// Finance work done by the administrator: record a payment or add a charge on a student's statement.
async function statement(page, name) {
  await page.goto(`${URL_BASE}/finance/students?q=${encodeURIComponent(name)}`);
  await page.click(`tbody a:has-text("${name}")`);
  await page.waitForURL(/\/finance\/students\/.+/);
}
async function pay(page, name, amount, ref) {
  await statement(page, name);
  await page.fill("#p-amount", amount);
  await page.fill("#p-ref", ref);
  await submit(page, 'button:has-text("Record payment")');
  await page.locator('.notice.ok:has-text("Payment recorded")').waitFor();
}

test("a class is taught and its results are published: Ama passes, Ben does not", async () => {
  classId = await setUpClass(ctx);
  const leo = await as(ctx, lecturer, DESK);
  const ids = {};
  for (const [title, category] of [["Coursework", "CONTINUOUS"], ["Project", "ASSIGNMENT"], ["Midterm", "MIDTERM"], ["Final", "FINAL"]]) {
    await leo.goto(`${URL_BASE}/teach/${classId}/assessments`);
    await leo.fill("#a-title", title);
    await leo.selectOption("#a-category", category);
    await leo.selectOption("#a-kind", "OFFLINE");
    await leo.fill("#a-max", "100");
    await leo.fill("#a-instructions", `Instructions for ${title}.`);
    await submit(leo, 'button:has-text("Create assessment")');
    await leo.waitForURL(/\/assessments\/[^/?]+\?/);
    ids[title] = leo.url().split("?")[0].split("/").pop();
    await submit(leo, 'button:has-text("Open to students")');
    for (const [student, score] of [["Ama Kollie", 90], ["Ben Dolo", 40]]) {
      await leo.goto(`${URL_BASE}/teach/${classId}/assessments/${ids[title]}`);
      await leo.click(`tr:has-text("${student}") a:has-text("Mark")`);
      await leo.waitForURL(/\/mark\//);
      await leo.fill("#score", String(score));
      await submit(leo, 'button:has-text("Save mark")');
      await leo.locator(".notice.ok").waitFor();
    }
  }
  await leo.goto(`${URL_BASE}/teach/${classId}/gradebook`);
  await submit(leo, 'button:has-text("Send results for 2 students for approval")');
  await leo.context().close();
  const dora = await as(ctx, dean, DESK);
  await dora.goto(`${URL_BASE}/admin/approvals`);
  await submit(dora, 'button[value="APPROVED"]');
  await dora.locator('.notice.ok:has-text("approved")').waitFor();
  await dora.context().close();
});

test("a certificate cannot be requested until the class has ended, the student passed and fees are cleared", async () => {
  const student = await as(ctx, ama);
  await student.goto(`${URL_BASE}/certificates`);
  let text = await student.locator("article").innerText();
  assert.match(text, /The class has ended[\s\S]*has not yet declared this class finished/);
  assert.match(text, /You passed[\s\S]*Your result is 90 of 100/);
  assert.match(text, /Your fees are cleared[\s\S]*You still owe US\$75/);
  assert.equal(await student.locator('button:has-text("Request my certificate")').count(), 0);

  // The lecturer cannot end the class; the registrar can.
  const leo = await as(ctx, lecturer, DESK);
  await leo.goto(`${URL_BASE}/admin/classes/${classId}`);
  assert.equal(path(leo), "/dashboard");
  await leo.context().close();
  const reg = await as(ctx, registrar, DESK);
  await reg.goto(`${URL_BASE}/admin/classes/${classId}`);
  await submit(reg, 'button:has-text("End this class")');
  assert.match(await reg.locator(".notice.ok").first().innerText(), /class has ended/);
  // Certificates issued on paper so far: diplomas up to DP-004.
  await reg.goto(`${URL_BASE}/admin/certificates`);
  await reg.fill("#last-DP", "4");
  await submit(reg, 'button:has-text("Save numbers")');
  await reg.context().close();

  await student.goto(`${URL_BASE}/certificates`);
  assert.equal(await student.locator('button:has-text("Request my certificate")').count(), 0, "fees are still owed");
  const admin = await as(ctx, ADMIN, DESK);
  await pay(admin, "Ama Kollie", "75", "MM-BALANCE-1");
  await admin.context().close();
  await student.goto(`${URL_BASE}/certificates`);
  assert.equal(await student.locator('button:has-text("Request my certificate")').count(), 1);
  await student.context().close();

  const failed = await as(ctx, ben);
  await failed.goto(`${URL_BASE}/certificates`);
  text = await failed.locator("article").innerText();
  assert.match(text, /Your result is 40 of 100\. The pass mark is 70/);
  assert.equal(await failed.locator('button:has-text("Request my certificate")').count(), 0);
  await failed.context().close();
});

test("the request is checked by the registrar, who can reject it with a reason; the student can ask again", async () => {
  const student = await as(ctx, ama);
  await student.goto(`${URL_BASE}/certificates`);
  await submit(student, 'button:has-text("Request my certificate")');
  assert.match(await student.locator("article").innerText(), /Requested[\s\S]*The registrar is checking your record/);
  assert.equal(await student.locator('button:has-text("Request my certificate")').count(), 0, "one request at a time");

  const dora = await as(ctx, dean, DESK);
  await dora.goto(`${URL_BASE}/admin/approvals`);
  assert.equal(await dora.locator('article button[value="APPROVED"]').count(), 0, "leadership sees the request but the registrar checks it first");
  await dora.context().close();

  const reg = await as(ctx, registrar, DESK);
  await reg.goto(`${URL_BASE}/admin/approvals`);
  assert.match(await reg.locator("article").innerText(), /Ama Kollie[\s\S]*Requests their certificate for QuickBooks · March 2027 · Weekday afternoons \(result 90 of 100\)/);
  await reg.click('a:has-text("See the student\'s record before deciding")');
  await reg.waitForURL(/\/admin\/certificates\/record\//);
  assert.match(await reg.locator("main").innerText(), /Qualifies[\s\S]*Diploma, QuickBooks, in the name Ama Kollie/);
  await reg.goto(`${URL_BASE}/admin/approvals`);
  await reg.fill('input[name="note"]', "Please confirm the spelling of your name with the office first.");
  await submit(reg, 'button[value="REJECTED"]');

  await student.goto(`${URL_BASE}/certificates`);
  assert.match(await student.locator(".notice.error").innerText(), /not approved: Please confirm the spelling of your name/);
  await submit(student, 'button:has-text("Request my certificate")');
  await reg.goto(`${URL_BASE}/admin/approvals`);
  await submit(reg, 'button[value="APPROVED"]');
  await reg.locator('.notice.ok:has-text("approved")').waitFor();
  assert.equal(await reg.locator("article").count(), 0, "the request has moved on to academic leadership");
  await student.goto(`${URL_BASE}/certificates`);
  assert.match(await student.locator(".notice.info").innerText(), /Academic leadership is approving your certificate/);
  await reg.context().close();
  await student.context().close();
});

test("leadership cannot issue if the student stops qualifying; once fees are clear, the certificate is issued with the next number", async () => {
  const admin = await as(ctx, ADMIN, DESK);
  await statement(admin, "Ama Kollie");
  await admin.selectOption("#c-kind", "EXAM");
  await admin.fill("#c-desc", "Exit examination");
  await admin.fill("#c-amount", "15");
  await submit(admin, 'button:has-text("Add charge")');

  const dora = await as(ctx, dean, DESK);
  await dora.goto(`${URL_BASE}/admin/approvals`);
  assert.match(await dora.locator("article").innerText(), /Record checked by Rita Registrar/);
  await submit(dora, 'button[value="APPROVED"]');
  assert.match(await dora.locator(".notice.error").innerText(), /no longer qualifies/);
  assert.equal(await dora.locator("article").count(), 1, "the request is still waiting");

  await pay(admin, "Ama Kollie", "15", "MM-EXAM-1");
  await admin.context().close();
  await dora.goto(`${URL_BASE}/admin/approvals`);
  await submit(dora, 'button[value="APPROVED"]');
  await dora.locator('.notice.ok:has-text("approved")').waitFor();
  await dora.goto(`${URL_BASE}/admin/certificates`);
  assert.match(await dora.locator("tbody tr").innerText(), /DP-005\s+Ama Kollie\s+Diploma, QuickBooks[\s\S]*Dora Dean\s+Valid/);
  await dora.context().close();
});

test("the student opens the certificate, laid out like TIME's paper certificate; nobody else can", async () => {
  const student = await as(ctx, ama, DESK);
  await student.goto(`${URL_BASE}/certificates`);
  assert.match(await student.locator("article").innerText(), /Issued[\s\S]*Diploma, QuickBooks\. ID NO DP-005/);
  await student.click('a:has-text("Open my certificate")');
  await student.waitForURL(/\/certificates\/.+/);
  certUrl = student.url();
  const text = await student.locator(".cert").innerText();
  assert.match(text, /TECHNICAL INSTITUTE FOR MANY EMPOWERMENT \(TIME INC\.\)/i);
  assert.match(text, /Mid-Liberia Christian School System, Ben's Town Community, Marshall Education District, Margibi County, Liberia/);
  assert.match(text, /DIPLOMA[\s\S]*QUICKBOOKS[\s\S]*Ama Kollie/i);
  assert.match(text, /Having successfully completed the prescribed course of study/);
  assert.match(text, /Awarded this \d+(st|nd|rd|th) day of \w+, \d{4} in Marshall Education District, Margibi County, Republic of Liberia/);
  assert.match(text, /Signed:[\s\S]*Executive Director/);
  assert.match(text, /ID NO: DP-005/);
  assert.ok(!/Ministry|Assistant Minister/.test(text), "a diploma does not carry the Ministry's wording or signature lines");
  code = text.match(/code ([A-Z0-9]{4}-[A-Z0-9]{4})/)[1];
  await student.waitForFunction(() => { const img = document.querySelector(".cert img"); return img && img.complete && img.naturalWidth > 0; }, null, { timeout: 10000 });
  await student.context().close();

  const other = await as(ctx, ben);
  assert.equal((await other.goto(certUrl)).status(), 404);
  await other.context().close();
});

test("anyone can check a certificate with its ID and code, without signing in; an ID alone reveals nothing", async () => {
  const visitor = await person(ctx);
  await visitor.goto(`${URL_BASE}/verify`);
  assert.equal(path(visitor), "/verify", "no sign-in needed");
  await visitor.fill("#number", "dp-005");
  await visitor.fill("#code", "AAAA-AAAA");
  await submit(visitor, 'button:has-text("Check certificate")');
  assert.match(await visitor.locator(".notice.error").innerText(), /No certificate matches/);
  assert.ok(!(await visitor.locator("main").innerText()).includes("Ama Kollie"), "a wrong code must not reveal the holder");

  await visitor.fill("#code", code.toLowerCase().replace("-", " "));
  await submit(visitor, 'button:has-text("Check certificate")');
  await visitor.locator("#result-h").waitFor();
  assert.match(await visitor.locator("section").innerText(), /This certificate is genuine[\s\S]*Valid[\s\S]*DP-005[\s\S]*Ama Kollie[\s\S]*Diploma, QuickBooks/);
  await visitor.context().close();
});

test("a revoked certificate shows as revoked to everyone", async () => {
  const reg = await as(ctx, registrar, DESK);
  await reg.goto(`${URL_BASE}/admin/certificates`);
  assert.equal(await reg.locator('summary:has-text("Revoke")').count(), 0, "the registrar cannot revoke");
  await reg.context().close();

  const dora = await as(ctx, dean, DESK);
  await dora.goto(`${URL_BASE}/admin/certificates`);
  await dora.click('summary:has-text("Revoke")');
  await dora.fill('input[name="reason"]', "Issued in error: the final examination is being re-marked.");
  await submit(dora, 'button:has-text("Revoke certificate")');
  assert.match(await dora.locator(".notice.ok").innerText(), /DP-005 is revoked/);
  await dora.context().close();

  const visitor = await person(ctx);
  await visitor.goto(`${URL_BASE}/verify?number=DP-005&code=${code}`);
  assert.match(await visitor.locator("section").innerText(), /This certificate has been revoked[\s\S]*Revoked/);
  await visitor.context().close();
  const student = await as(ctx, ama, DESK);
  await student.goto(certUrl);
  assert.match(await student.locator(".notice.error").innerText(), /revoked: Issued in error/);
  assert.equal(await student.locator(".cert-revoked").count(), 1);
  await student.context().close();
});

test("every step toward the certificate is in the activity log", async () => {
  const admin = await as(ctx, ADMIN, DESK);
  await admin.goto(`${URL_BASE}/admin/activity`);
  const text = await admin.locator("table").innerText();
  for (const expected of [
    "Rita Registrar ended the class QuickBooks · March 2027 · Weekday afternoons",
    "Rita Registrar set the last paper certificate numbers",
    "Ama Kollie requested their certificate for QuickBooks · March 2027 · Weekday afternoons",
    "Rita Registrar rejected the certificate: check the record request from Ama Kollie",
    "Ama Kollie's record was checked for a certificate and sent to academic leadership",
    "Certificate DP-005 (Diploma, QuickBooks) was issued to Ama Kollie",
    "Dora Dean revoked certificate DP-005 (Ama Kollie). Reason: Issued in error: the final examination is being re-marked.",
  ]) assert.ok(text.includes(expected), expected);
  assert.deepEqual(admin.problems, []);
  await admin.context().close();
});
