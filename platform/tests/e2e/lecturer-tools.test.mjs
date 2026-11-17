import { test } from "node:test";
import assert from "node:assert/strict";
import { DESK, PEOPLE, URL_BASE, as, setUpClass, submit, useApp } from "./helpers.mjs";

const ctx = useApp();
const { lecturer, dean, ama } = PEOPLE;
const notice = (page, kind, text) => page.locator(`.notice.${kind}`, { hasText: text }).first().waitFor({ timeout: 10000 });
const LESSON = `# What is a cash book?
A cash book records **every payment** in and out.

- Money received
- Money paid out

## How to fill it in
1. Write the date
2. Write the amount`;
let classId;

test("set-up: a class with a lecturer and two students", async () => {
  classId = await setUpClass(ctx);
});

test("a lecturer writes a lesson with headings, lists, bold text and a YouTube video", async () => {
  const leo = await as(ctx, lecturer, DESK);
  await leo.goto(`${URL_BASE}/teach/${classId}/content`);
  await leo.fill("#module-title", "Week 1");
  await submit(leo, 'button:has-text("Add module")');
  await leo.click('a:has-text("Write a lesson")');
  await leo.waitForURL(/content\/new/);
  await leo.fill("#title", "The cash book");
  await leo.fill("#body", LESSON);
  await leo.fill("#videoUrl", "https://vimeo.com/12345");
  await submit(leo, 'button:has-text("Save draft")');
  await notice(leo, "error", "Paste a YouTube link");

  await leo.fill("#title", "The cash book");
  await leo.fill("#body", LESSON);
  await leo.fill("#videoUrl", "https://youtu.be/dQw4w9WgXcQ?si=share");
  await submit(leo, 'button:has-text("Save draft")');
  await notice(leo, "ok", "saved as a draft");
  await leo.goto(`${URL_BASE}/teach/${classId}/content`);
  await submit(leo, 'button:has-text("for review")');
  await leo.context().close();

  const dora = await as(ctx, dean, DESK);
  await dora.goto(`${URL_BASE}/admin/approvals`);
  await dora.click('a:has-text("Read the lessons before deciding")');
  await dora.waitForURL(/\/admin\/content\//);
  assert.match(await dora.locator("main").innerText(), /Video: https:\/\/youtu\.be\/dQw4w9WgXcQ/);
  await dora.goto(`${URL_BASE}/admin/approvals`);
  await submit(dora, 'button[value="APPROVED"]');
  await notice(dora, "ok", "approved");
  await dora.context().close();
});

test("the student sees the formatted lesson; the video loads only when play is pressed", async () => {
  const page = await as(ctx, ama);
  await page.goto(`${URL_BASE}/learn/${classId}`);
  await page.click('.lesson-list a:has-text("The cash book")');
  await page.waitForURL(/\/learn\/[^/]+\/[^/]+$/);
  const body = page.locator(".lesson-body");
  assert.equal(await body.locator("h2").innerText(), "What is a cash book?");
  assert.equal(await body.locator("h3").innerText(), "How to fill it in");
  assert.equal(await body.locator("strong").innerText(), "every payment");
  assert.deepEqual(await body.locator("ul li").allInnerTexts(), ["Money received", "Money paid out"]);
  assert.deepEqual(await body.locator("ol li").allInnerTexts(), ["Write the date", "Write the amount"]);
  assert.ok(!(await body.innerText()).includes("**"), "the marks themselves are not shown");

  assert.equal(await page.locator("iframe").count(), 0, "nothing is loaded from YouTube before play is pressed");
  await page.click('button:has-text("Play the video")');
  const src = await page.locator(".video iframe").getAttribute("src");
  assert.match(src, /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/);
  assert.equal(await page.locator('.video a:has-text("Open it on YouTube")').getAttribute("href"), "https://youtu.be/dQw4w9WgXcQ?si=share");
  // The security rules allow the YouTube player and nothing else in a frame.
  const csp = (await page.goto(page.url())).headers()["content-security-policy"];
  assert.match(csp, /frame-src https:\/\/www\.youtube-nocookie\.com(;|$)/);
  assert.deepEqual(page.problems.filter((p) => /Content.Security.Policy/i.test(p)), []);
  await page.context().close();
});

test("a live class on Google Meet: students are told, join by name of the service, and get the recording afterwards", async () => {
  const leo = await as(ctx, lecturer, DESK);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  for (const [title, when, url] of [["Week 1 live class", yesterday, "https://us02web.zoom.us/j/123456789"], ["Week 2 live class", tomorrow, "https://meet.google.com/abc-defg-hij"]]) {
    await leo.goto(`${URL_BASE}/teach/${classId}/sessions`);
    await leo.fill("#s-title", title);
    await leo.fill("#s-when", when);
    await leo.fill("#s-url", url);
    await submit(leo, 'button:has-text("Add session")');
    await notice(leo, "ok", "Your students have been told");
  }
  assert.match(await leo.locator('tr:has-text("Week 2 live class")').innerText(), /Join on Google Meet/);
  assert.equal(await leo.locator('tr:has-text("Week 2 live class") input[name="recordingUrl"]').count(), 0, "a class that has not happened yet has no recording");

  const row = leo.locator('tr:has-text("Week 1 live class")');
  await row.locator('input[name="recordingUrl"]').fill("not a link");
  await submit(leo, 'tr:has-text("Week 1 live class") button:has-text("Save")');
  await notice(leo, "error", "starts with https://");
  await leo.locator('tr:has-text("Week 1 live class") input[name="recordingUrl"]').fill("https://youtu.be/aaaaaaaaaaa");
  await submit(leo, 'tr:has-text("Week 1 live class") button:has-text("Save")');
  await notice(leo, "ok", "Recording added");
  await leo.context().close();

  const page = await as(ctx, ama);
  await page.goto(`${URL_BASE}/learn/${classId}`);
  const text = await page.locator("main").innerText();
  assert.match(text, /Coming sessions[\s\S]*Week 2 live class[\s\S]*Join on Google Meet/);
  assert.equal(await page.locator('section:has(#rec-h) a:has-text("Watch the recording")').getAttribute("href"), "https://youtu.be/aaaaaaaaaaa");
  await page.goto(`${URL_BASE}/notifications`);
  const inbox = await page.locator("main").innerText();
  assert.match(inbox, /Live class: Week 2 live class/);
  assert.match(inbox, /Recording available: Week 1 live class/);
  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test("a quiz mixes multiple choice, true or false and short answer, and marks them all", async () => {
  const leo = await as(ctx, lecturer, DESK);
  await leo.goto(`${URL_BASE}/teach/${classId}/assessments`);
  await leo.fill("#a-title", "Week 1 quiz");
  await leo.selectOption("#a-category", "CONTINUOUS");
  await leo.selectOption("#a-kind", "QUIZ");
  await leo.fill("#a-instructions", "Answer every question.");
  await submit(leo, 'button:has-text("Create assessment")');
  await leo.waitForURL(/\/assessments\/[^/?]+\?/);
  const add = async (type, fields) => {
    await leo.selectOption("#q-type", type);
    for (const [sel, val] of Object.entries(fields)) {
      if (sel === "#q-truth") await leo.selectOption(sel, val); else await leo.fill(sel, val);
    }
    await submit(leo, 'button:has-text("Add question")');
  };
  // Only the fields for the chosen kind are shown.
  await leo.selectOption("#q-type", "SHORT");
  assert.ok(await leo.locator("#q-accepted").isVisible());
  assert.ok(!(await leo.locator("#q-options").isVisible()));

  await add("SHORT", { "#q-text": "What does a cash book record?", "#q-points": "1" });
  await notice(leo, "error", "Give at least one accepted answer");
  await leo.locator("#questions-h", { hasText: "Questions (0)" }).waitFor({ timeout: 10000 });
  // Each saved question is waited for, so the next one is added on the refreshed page.
  const saved = (n) => leo.locator("#questions-h", { hasText: `Questions (${n})` }).waitFor({ timeout: 10000 });
  await add("CHOICE", { "#q-text": "Which is money coming in?", "#q-options": "Rent paid\nA sale\nWages paid", "#q-correct": "2", "#q-points": "1" });
  await saved(1);
  await add("TRUE_FALSE", { "#q-text": "A receipt should be kept for every sale.", "#q-truth": "TRUE", "#q-points": "1" });
  await saved(2);
  await add("SHORT", { "#q-text": "A shop sells rice for how much?", "#q-accepted": "LRD 500\n500 Liberian dollars\nlrd 500", "#q-points": "2" });
  await saved(3);
  const text = await leo.locator("section:has(#questions-h)").innerText();
  assert.match(text, /True or false[\s\S]*True\s*Correct/);
  assert.match(text, /Short answer\s+Accepted: LRD 500\s*500 Liberian dollars/);
  assert.ok(!/lrd 500\s*$/m.test(text.split("Accepted:")[1]), "a duplicate accepted answer is kept once");
  await submit(leo, 'button:has-text("Open to students")');
  await leo.context().close();

  const page = await as(ctx, ama);
  await page.goto(`${URL_BASE}/learn/${classId}`);
  await page.click('a:has-text("Week 1 quiz")');
  await submit(page, 'button:has-text("Start the quiz")');
  const html = await page.content();
  assert.ok(!html.includes("500 Liberian dollars"), "accepted answers are never sent to the student");
  await page.locator('fieldset:has-text("money coming in") label:has-text("A sale") input').check();
  await page.locator('fieldset:has-text("receipt") label:has-text("True") input').check();
  await page.locator('fieldset:has-text("rice") input[type="text"]').fill("  Lrd 500. ");
  await submit(page, 'button:has-text("Hand in quiz")');
  await notice(page, "ok", "You scored 4 of 4");
  await page.context().close();
});
