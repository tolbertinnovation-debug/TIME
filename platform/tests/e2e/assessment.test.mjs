import { test } from "node:test";
import assert from "node:assert/strict";
import { DESK, PEOPLE, URL_BASE, as, setUpClass, submit, testDb, useApp } from "./helpers.mjs";

const ctx = useApp();
const { lecturer, dean, registrar, ama, ben } = PEOPLE;
const status = async (page, path) => (await page.goto(URL_BASE + path)).status();

let classId;
const ids = {}; // assessment title -> id

async function createAssessment(page, { title, category, kind, max, limit }) {
  await page.goto(`${URL_BASE}/teach/${classId}/assessments`);
  await page.fill("#a-title", title);
  await page.selectOption("#a-category", category);
  await page.selectOption("#a-kind", kind);
  if (max) await page.fill("#a-max", String(max));
  if (limit) await page.fill("#a-limit", String(limit));
  await page.fill("#a-instructions", `Instructions for ${title}.`);
  await submit(page, 'button:has-text("Create assessment")');
  await page.waitForURL(/\/assessments\/[^/?]+\?/);
  ids[title] = page.url().split("?")[0].split("/").pop();
}

async function mark(page, title, student, score, { feedback, reason } = {}) {
  await page.goto(`${URL_BASE}/teach/${classId}/assessments/${ids[title]}`);
  await page.click(`tr:has-text("${student}") a:has-text("ark")`);
  await page.waitForURL(/\/mark\//);
  await page.fill("#score", String(score));
  if (feedback) await page.fill("#feedback", feedback);
  if (reason) await page.fill("#reason", reason);
  await submit(page, 'button:has-text("Save mark")');
}

async function answerQuiz(page, choices) {
  for (const [question, option] of choices) await page.check(`fieldset:has-text("${question}") input[value="${option}"]`);
  await submit(page, 'button:has-text("Hand in quiz")');
}

test("a class is ready", async () => { classId = await setUpClass(ctx); });

test("the lecturer sets a quiz, written work and two exams; drafts are hidden from students", async () => {
  const leo = await as(ctx, lecturer, DESK);
  await createAssessment(leo, { title: "Week 1 quiz", category: "CONTINUOUS", kind: "QUIZ", limit: 30 });
  await submit(leo, 'button:has-text("Open to students")');
  assert.match(await leo.locator(".notice.error").innerText(), /at least one question/);
  for (const [text, options, correct, points] of [
    ["What does a cash book record?", "Staff names\nMoney in and money out\nThe weather", 2, 2],
    ["Which is an expense?", "Rent paid\nA sale\nA loan received", 1, 3],
  ]) {
    await leo.fill("#q-text", text);
    await leo.fill("#q-options", options);
    await leo.fill("#q-correct", String(correct));
    await leo.fill("#q-points", String(points));
    await submit(leo, 'button:has-text("Add question")');
    await leo.locator(`h3:has-text("${text}")`).waitFor();
  }
  assert.match(await leo.locator("main").innerText(), /out of 5 · 30 minute limit/);

  const student = await as(ctx, ama);
  assert.equal(await status(student, `/learn/${classId}/assess/${ids["Week 1 quiz"]}`), 404, "a draft assessment is hidden");
  await student.context().close();

  await submit(leo, 'button:has-text("Open to students")');
  await createAssessment(leo, { title: "Cash book exercise", category: "ASSIGNMENT", kind: "WRITTEN", max: 20 });
  await submit(leo, 'button:has-text("Open to students")');
  await createAssessment(leo, { title: "Midterm exam", category: "MIDTERM", kind: "OFFLINE", max: 50 });
  await submit(leo, 'button:has-text("Open to students")');
  await createAssessment(leo, { title: "Final exam", category: "FINAL", kind: "OFFLINE", max: 100 });
  await submit(leo, 'button:has-text("Open to students")');
  await leo.context().close();
});

test("a student takes the quiz once, is marked at once, and never sees the correct answers", async () => {
  const student = await as(ctx, ama);
  await student.goto(`${URL_BASE}/learn/${classId}`);
  await student.click('a:has-text("Week 1 quiz")');
  await student.waitForURL(/\/assess\//);
  await submit(student, 'button:has-text("Start the quiz")');
  const html = await student.content();
  assert.ok(!/correctIndex|Correct</.test(html), "the page holds no answer key");
  assert.match(await student.locator(".notice.info").innerText(), /Hand in by/);
  await answerQuiz(student, [["What does a cash book record?", 1], ["Which is an expense?", 0]]);
  await student.locator('.notice.ok:has-text("You scored 5 of 5")').waitFor();
  assert.equal(await student.locator('button:has-text("Hand in quiz"), button:has-text("Start the quiz")').count(), 0, "one attempt only");
  await student.context().close();
});

test("a quiz handed in after the time limit gets no marks; the lecturer can allow another attempt, with a reason", async () => {
  const student = await as(ctx, ben);
  await student.goto(`${URL_BASE}/learn/${classId}/assess/${ids["Week 1 quiz"]}`);
  await submit(student, 'button:has-text("Start the quiz")');
  // Move the start of Ben's attempt two hours back, as if he had left the quiz open.
  await testDb(`UPDATE submission SET "startedAt" = now() - interval '2 hours' WHERE "assessmentId" = $1 AND "submittedAt" IS NULL`, [ids["Week 1 quiz"]]);
  await answerQuiz(student, [["What does a cash book record?", 1], ["Which is an expense?", 0]]);
  await student.locator('.notice.error:has-text("time had run out")').waitFor();
  assert.match(await student.locator("main").innerText(), /Your mark: 0 of 5/);

  const leo = await as(ctx, lecturer, DESK);
  await leo.goto(`${URL_BASE}/teach/${classId}/assessments/${ids["Week 1 quiz"]}`);
  await leo.click('tr:has-text("Ben Dolo") summary');
  await leo.fill('tr:has-text("Ben Dolo") input[name=reason]', "His connection failed during the quiz.");
  await submit(leo, 'tr:has-text("Ben Dolo") button:has-text("Reset attempt")');
  assert.match(await leo.locator(".notice.ok").innerText(), /Ben Dolo can take this assessment again/);
  await leo.context().close();

  await student.goto(`${URL_BASE}/learn/${classId}/assess/${ids["Week 1 quiz"]}`);
  await submit(student, 'button:has-text("Start the quiz")');
  await answerQuiz(student, [["What does a cash book record?", 0], ["Which is an expense?", 0]]);
  await student.locator('.notice.ok:has-text("You scored 3 of 5")').waitFor();
  await student.context().close();
});

test("written work is handed in, marked with feedback, and a changed mark needs a reason", async () => {
  const student = await as(ctx, ama);
  await student.goto(`${URL_BASE}/learn/${classId}/assess/${ids["Cash book exercise"]}`);
  await student.fill("#text", "On Monday the shop sold rice for LRD 500 and paid LRD 200 for transport, so the cash book shows 300 left.");
  await submit(student, 'button:has-text("Hand in")');
  assert.match(await student.locator(".notice.ok").innerText(), /handed in/);

  const leo = await as(ctx, lecturer, DESK);
  await leo.goto(`${URL_BASE}/teach/${classId}/assessments/${ids["Cash book exercise"]}`);
  assert.equal(await leo.locator('tr:has-text("Ben Dolo") a:has-text("ark")').count(), 0, "work that was not handed in cannot be marked");
  await mark(leo, "Cash book exercise", "Ama Kollie", 25);
  assert.match(await leo.locator(".notice.error").innerText(), /cannot be more than 20/);
  await mark(leo, "Cash book exercise", "Ama Kollie", 16, { feedback: "Clear working. Show the opening balance next time." });
  assert.match(await leo.locator(".notice.ok").innerText(), /Ama Kollie: 16 of 20 saved/);
  await mark(leo, "Cash book exercise", "Ama Kollie", 18);
  assert.match(await leo.locator(".notice.error").innerText(), /reason for changing/);
  await mark(leo, "Cash book exercise", "Ama Kollie", 18, { reason: "Opening balance was shown on page 2." });
  assert.match(await leo.locator(".notice.ok").innerText(), /18 of 20 saved/);

  await student.goto(`${URL_BASE}/learn/${classId}/assess/${ids["Cash book exercise"]}`);
  assert.match(await student.locator("main").innerText(), /Your mark: 18 of 20[\s\S]*Show the opening balance/);
  assert.equal(await student.locator("#text").count(), 0, "marked work cannot be changed");
  await student.context().close();
  await leo.context().close();
});

test("exam marks are entered, and the gradebook applies the 30 / 20 / 20 / 30 split and the pass mark of 70", async () => {
  const leo = await as(ctx, lecturer, DESK);
  for (const [title, student, score] of [["Midterm exam", "Ama Kollie", 40], ["Midterm exam", "Ben Dolo", 20], ["Final exam", "Ama Kollie", 80], ["Final exam", "Ben Dolo", 50]]) {
    await mark(leo, title, student, score);
    await leo.locator(".notice.ok").waitFor();
  }
  await leo.goto(`${URL_BASE}/teach/${classId}/gradebook`);
  // Ama: 5/5 -> 30, 18/20 -> 18, 40/50 -> 16, 80/100 -> 24. Ben: 3/5 -> 18, 0, 20/50 -> 8, 50/100 -> 15.
  assert.match(await leo.locator('tr:has-text("Ama Kollie")').innerText(), /30\s+18\s+16\s+24\s+88\s+Pass\s+Not sent/);
  assert.match(await leo.locator('tr:has-text("Ben Dolo")').innerText(), /18\s+0\s+8\s+15\s+41\s+Below 70\s+Not sent/);
  await leo.context().close();

  const student = await as(ctx, ama);
  await student.goto(`${URL_BASE}/learn/${classId}`);
  assert.equal(await student.locator("#result-h").count(), 0, "no result is shown before it is published");
  await student.context().close();
});

test("results are locked while waiting, rejected with a reason, sent again and published", async () => {
  const leo = await as(ctx, lecturer, DESK);
  await leo.goto(`${URL_BASE}/teach/${classId}/gradebook`);
  await submit(leo, 'button:has-text("Send results for 2 students for approval")');
  assert.match(await leo.locator(".notice.ok").innerText(), /locked/);
  await mark(leo, "Final exam", "Ben Dolo", 90, { reason: "Trying to change a locked mark." });
  assert.match(await leo.locator(".notice.error").innerText(), /waiting for approval, so marks are locked/);

  const reg = await as(ctx, registrar, DESK);
  await reg.goto(`${URL_BASE}/admin/approvals`);
  assert.equal(await reg.locator("article").count(), 0, "the registrar does not approve results");
  assert.equal(new URL((await reg.goto(`${URL_BASE}/admin/results/${classId}`)).url()).pathname, "/dashboard");
  await reg.context().close();

  const dora = await as(ctx, dean, DESK);
  await dora.goto(`${URL_BASE}/admin/approvals`);
  assert.match(await dora.locator("article").innerText(), /Asks to publish results for 2 students in QuickBooks · March 2027/);
  await dora.click('a:has-text("See the class results before deciding")');
  await dora.waitForURL(/\/admin\/results\//);
  assert.match(await dora.locator('tr:has-text("Ama Kollie")').innerText(), /88\s+Pass\s+Waiting for approval/);
  await dora.goto(`${URL_BASE}/admin/approvals`);
  await dora.fill('input[name="note"]', "Please check Ben's midterm paper again.");
  await submit(dora, 'button[value="REJECTED"]');

  await leo.goto(`${URL_BASE}/teach/${classId}/gradebook`);
  assert.match(await leo.locator('tr:has-text("Ben Dolo")').innerText(), /Not sent/);
  await submit(leo, 'button:has-text("Send results for 2 students for approval")');
  await dora.goto(`${URL_BASE}/admin/approvals`);
  await submit(dora, 'button[value="APPROVED"]');
  assert.match(await dora.locator(".notice.ok").innerText(), /approved/);

  for (const [creds, expected] of [[ama, /Your result: 88 of 100[\s\S]*Pass/], [ben, /Your result: 41 of 100[\s\S]*Below the pass mark of 70/]]) {
    const student = await as(ctx, creds);
    await student.goto(`${URL_BASE}/learn/${classId}`);
    assert.match(await student.locator("#result-h").locator("..").innerText(), expected);
    await student.context().close();
  }
  await mark(leo, "Final exam", "Ama Kollie", 100, { reason: "Trying to change a published result." });
  assert.match(await leo.locator(".notice.error").innerText(), /result is published/);
  await leo.context().close();
  await dora.context().close();
});

test("an approved appeal reopens only that student's result for re-marking", async () => {
  const student = await as(ctx, ben);
  await student.goto(`${URL_BASE}/learn/${classId}`);
  await student.click('summary:has-text("Appeal this result")');
  await student.fill("#appeal-reason", "I believe two pages of my midterm paper were not marked.");
  await submit(student, 'button:has-text("Send appeal")');
  assert.match(await student.locator("main").innerText(), /appeal is waiting for a decision/);

  const dora = await as(ctx, dean, DESK);
  await dora.goto(`${URL_BASE}/admin/approvals`);
  assert.match(await dora.locator("article").innerText(), /Ben Dolo[\s\S]*Appeals their result of 41 of 100/);
  await submit(dora, 'button[value="APPROVED"]');
  await dora.context().close();

  await student.goto(`${URL_BASE}/learn/${classId}`);
  assert.equal(await student.locator("#result-h").count(), 0, "the result is withdrawn while it is re-marked");

  const leo = await as(ctx, lecturer, DESK);
  await mark(leo, "Midterm exam", "Ben Dolo", 45, { reason: "Two unmarked pages found after the appeal." });
  assert.match(await leo.locator(".notice.ok").innerText(), /45 of 50 saved/);
  await leo.goto(`${URL_BASE}/teach/${classId}/gradebook`);
  assert.match(await leo.locator('tr:has-text("Ama Kollie")').innerText(), /88\s+Pass\s+Published/);
  await submit(leo, 'button:has-text("Send results for 1 student for approval")');
  await leo.context().close();

  const dora2 = await as(ctx, dean, DESK);
  await dora2.goto(`${URL_BASE}/admin/approvals`);
  await submit(dora2, 'button[value="APPROVED"]');
  await dora2.context().close();
  await student.goto(`${URL_BASE}/learn/${classId}`);
  // Midterm 45/50 -> 18, so 18 + 0 + 18 + 15 = 51.
  assert.match(await student.locator("#result-h").innerText(), /Your result: 51 of 100/);
  await student.context().close();
});

test("every mark, change and decision is in the activity log with its reason", async () => {
  const admin = await as(ctx, { email: "admin@example.test", password: "admin-password-123" }, DESK);
  await admin.goto(`${URL_BASE}/admin/activity?group=grade`);
  const marks = await admin.locator("table").innerText();
  for (const expected of [
    'Leo Lecturer gave Ama Kollie 16 of 20 for "Cash book exercise"',
    'Leo Lecturer changed Ama Kollie\'s mark for "Cash book exercise" from 16 to 18 of 20. Reason: Opening balance was shown on page 2.',
    'Leo Lecturer changed Ben Dolo\'s mark for "Midterm exam" from 20 to 45 of 50. Reason: Two unmarked pages found after the appeal.',
  ]) assert.ok(marks.includes(expected), expected);

  await admin.goto(`${URL_BASE}/admin/activity`);
  const all = await admin.locator("table").innerText();
  for (const expected of [
    "Results for 1 student were published in QuickBooks, March 2027",
    "Ben Dolo's result was reopened for re-marking after an appeal",
    "Ben Dolo appealed their result of 41",
    "Dora Dean rejected the results to publish request from Leo Lecturer",
  ]) assert.ok(all.includes(expected), expected);
  await admin.goto(`${URL_BASE}/admin/activity?q=${encodeURIComponent("take")}`);
  assert.ok((await admin.locator("table").innerText()).includes('Leo Lecturer let Ben Dolo take "Week 1 quiz" again (previous mark: 0). Reason: His connection failed during the quiz.'));
  assert.deepEqual(admin.problems, []);
  await admin.context().close();
});
