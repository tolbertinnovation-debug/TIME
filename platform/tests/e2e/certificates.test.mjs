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

test("a student opens their transcript; staff who keep records can open it; other students cannot", async () => {
  const student = await as(ctx, ama, DESK);
  await student.goto(`${URL_BASE}/certificates`);
  await student.click('a:has-text("My transcript")');
  await student.waitForURL("**/transcript");
  const text = await student.locator(".transcript").innerText();
  assert.match(text, /Academic transcript[\s\S]*Ama Kollie[\s\S]*TIME-\d{4}-\d{4}/);
  assert.match(text, /QuickBooks[\s\S]*March 2027[\s\S]*27\s+18\s+18\s+27\s+90\s+Pass/);
  assert.match(text, /Courses passed: 1 of 1/);
  assert.ok(!text.includes("DP-005"), "a revoked certificate is not listed");
  const [{ id: amaId }] = await testDb('SELECT id FROM "user" WHERE email = $1', [ama.email]);
  await student.context().close();

  const other = await as(ctx, ben, DESK);
  await other.goto(`${URL_BASE}/transcript`);
  assert.match(await other.locator(".transcript").innerText(), /Ben Dolo[\s\S]*40\s+Not passed[\s\S]*Courses passed: 0 of 1/);
  await other.goto(`${URL_BASE}/transcript/${amaId}`);
  assert.equal(path(other), "/dashboard", "a student cannot open another student's transcript");
  await other.context().close();

  const reg = await as(ctx, registrar, DESK);
  await reg.goto(`${URL_BASE}/admin/users?q=${encodeURIComponent(ama.email)}`);
  await reg.click('tbody a:has-text("Transcript")');
  await reg.waitForURL(`**/transcript/${amaId}`);
  assert.match(await reg.locator(".transcript").innerText(), /Ama Kollie[\s\S]*90\s+Pass/);
  assert.equal((await reg.goto(`${URL_BASE}/transcript/not-a-student`)).status(), 404);
  await reg.context().close();
});

test("reports download as spreadsheets for the roles allowed, and each download is logged", async () => {
  const rows = (csv) => csv.replace(/^﻿/, "").trimEnd().split("\r\n");
  const reg = await as(ctx, registrar, DESK);
  await reg.goto(`${URL_BASE}/admin/reports`);
  assert.deepEqual(await reg.locator("section h2").allInnerTexts(), ["Enrolment", "Results"], "the registrar has no payments report");

  const [download] = await Promise.all([reg.waitForEvent("download"), reg.click('button:has-text("Download results report")')]);
  assert.match(download.suggestedFilename(), /^time-results-all-intakes-\d{4}-\d{2}-\d{2}\.csv$/);

  const results = rows(await (await reg.request.get(`${URL_BASE}/api/reports/results`)).text());
  assert.match(results[0], /^Student number,Name,Course,Program,Intake,/);
  assert.equal(results.length, 3, "a header and two published results");
  assert.match(results.find((r) => r.includes("Ama Kollie")), /^TIME-\d{4}-\d{4},Ama Kollie,QuickBooks,.*,March 2027,27,18,18,27,90,Yes,\d{4}-\d{2}-\d{2},$/);
  assert.match(results.find((r) => r.includes("Ben Dolo")), /,40,No,/);

  const enrolment = rows(await (await reg.request.get(`${URL_BASE}/api/reports/enrolment`)).text());
  assert.equal(enrolment.length, 3);
  assert.match(enrolment[1], /,Margibi,QuickBooks,.*,March 2027,Weekday afternoons,Online,,Enrolled,\d{4}-\d{2}-\d{2}$/);
  // Choosing another intake leaves only the header.
  const [{ id: october }] = await testDb("SELECT id FROM intake WHERE name = 'October 2027'");
  assert.equal(rows(await (await reg.request.get(`${URL_BASE}/api/reports/enrolment?intake=${october}`)).text()).length, 1);
  assert.equal((await reg.request.get(`${URL_BASE}/api/reports/enrolment?intake=nope`)).status(), 404);
  assert.equal((await reg.request.get(`${URL_BASE}/api/reports/payments`)).status(), 404, "the registrar cannot download payments");
  await reg.context().close();

  const student = await as(ctx, ama, DESK);
  for (const kind of ["enrolment", "results", "payments"]) assert.equal((await student.request.get(`${URL_BASE}/api/reports/${kind}`)).status(), 404);
  await student.goto(`${URL_BASE}/admin/reports`);
  assert.equal(path(student), "/dashboard");
  await student.context().close();
  const visitor = await person(ctx);
  assert.equal((await visitor.request.get(`${URL_BASE}/api/reports/results`)).status(), 404, "nobody gets a report without signing in");
  await visitor.context().close();

  const admin = await as(ctx, ADMIN, DESK);
  const payments = rows(await (await admin.request.get(`${URL_BASE}/api/reports/payments`)).text());
  assert.match(payments[0], /^Receipt number,Paid on,Student number,Name,Course,Intake,Amount \(USD\),Method,Reference,/);
  assert.ok(payments.length > 2, "confirmed payments are listed");
  assert.ok(payments.slice(1).every((r) => /^R-\d+,\d{4}-\d{2}-\d{2},TIME-/.test(r)), "every row has a receipt number");
  await admin.goto(`${URL_BASE}/admin/activity`);
  const log = await admin.locator("table").innerText();
  for (const expected of [
    "Rita Registrar downloaded the results report (all intakes, 2 rows)",
    "Rita Registrar downloaded the enrolment report (October 2027, 0 rows)",
    "Test Admin downloaded the payments report (all intakes,",
    "Rita Registrar opened the transcript of Ama Kollie",
  ]) assert.ok(log.includes(expected), expected);
  await admin.context().close();
});

test("students evaluate the course anonymously; staff see a summary only once three have answered", async () => {
  const fill = async (page, score, wentWell, improve) => {
    await page.goto(`${URL_BASE}/learn/${classId}`);
    await page.click('a:has-text("Evaluate this course")');
    await page.waitForURL(`**/evaluate/${classId}`);
    for (const q of ["teaching", "materials", "support", "overall"]) await page.check(`input[name="${q}"][value="${score}"]`);
    await page.fill("#wentWell", wentWell);
    await page.fill("#improve", improve);
    await submit(page, 'button:has-text("Hand in evaluation")');
    await page.locator('.notice.ok:has-text("stored without your name")').waitFor();
  };
  const student = await as(ctx, ama);
  await fill(student, 5, "The worked examples from a real shop.", "More practice quizzes.");
  assert.equal(await student.locator("form.form").count(), 0, "an evaluation is handed in once");
  await student.goto(`${URL_BASE}/learn/${classId}`);
  assert.equal(await student.locator('a:has-text("Evaluate this course")').count(), 0);
  await student.context().close();

  const leo = await as(ctx, lecturer, DESK);
  await leo.goto(`${URL_BASE}/teach/${classId}/evaluations`);
  let text = await leo.locator("main").innerText();
  assert.match(text, /1 of 2 students have answered\. To keep answers anonymous, results appear once at least 3 students have answered/);
  assert.ok(!text.includes("worked examples"), "comments are hidden until enough students answer");

  const other = await as(ctx, ben);
  await fill(other, 3, "", "Audio versions of the lessons.");
  await other.context().close();
  // A third answer, as if from another student, brings the class to the number needed.
  await testDb(`INSERT INTO course_evaluation (id, "classId", teaching, materials, support, overall, "wentWell") VALUES ('ev-third', $1, 4, 4, 2, 4, 'Clear notes.')`, [classId]);

  await leo.reload();
  text = await leo.locator("main").innerText();
  assert.match(text, /3 of \d students answered/);
  assert.match(text, /The teaching\s+4\.0\s+1\s+1\s+1\s+0\s+0/);
  assert.match(text, /Support from TIME\s+3\.3/);
  assert.match(text, /What went well[\s\S]*Clear notes\.[\s\S]*The worked examples from a real shop\.[\s\S]*What should be improved[\s\S]*Audio versions of the lessons\.[\s\S]*More practice quizzes\./);
  assert.ok(!/Ama Kollie|Ben Dolo/.test(text), "no student is named");
  await leo.context().close();

  const dora = await as(ctx, dean, DESK);
  await dora.goto(`${URL_BASE}/admin/evaluations`);
  assert.match(await dora.locator("tbody tr").first().innerText(), /QuickBooks[\s\S]*Leo Lecturer\s+3 of 2\s+4\.0/);
  await dora.click("tbody a");
  await dora.waitForURL(`**/admin/evaluations/${classId}`);
  assert.match(await dora.locator("main").innerText(), /The course overall\s+4\.0/);
  await dora.context().close();

  const reg = await as(ctx, registrar, DESK);
  await reg.goto(`${URL_BASE}/admin/evaluations`);
  assert.equal(path(reg), "/dashboard", "the registrar does not see evaluations");
  await reg.context().close();

  // Nothing stored with an evaluation says who wrote it.
  const columns = (await testDb("SELECT column_name FROM information_schema.columns WHERE table_name = 'course_evaluation'")).map((r) => r.column_name).sort();
  assert.deepEqual(columns, ["classId", "id", "improve", "materials", "overall", "support", "teaching", "wentWell"]);
  const admin = await as(ctx, ADMIN, DESK);
  await admin.goto(`${URL_BASE}/admin/activity?q=evaluated`);
  const log = await admin.locator("table").innerText();
  assert.ok(log.includes("A student evaluated QuickBooks · March 2027 · Weekday afternoons"));
  assert.ok(!/(Ama Kollie|Ben Dolo) evaluated/.test(log));
  await admin.context().close();
});
