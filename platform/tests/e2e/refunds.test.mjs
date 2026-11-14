import { test } from "node:test";
import assert from "node:assert/strict";
import { ADMIN, DESK, PEOPLE, URL_BASE, as, makeStaff, setUpClass, submit, useApp } from "./helpers.mjs";

const ctx = useApp();
const { dean, ama, ben } = PEOPLE;
const finance = { name: "Fiona Finance", email: "fiona@example.test", password: "finance-password-1" };
const path = (page) => new URL(page.url()).pathname;

async function statement(page, name) {
  await page.goto(`${URL_BASE}/finance/students?q=${encodeURIComponent(name)}`);
  await page.click(`tbody a:has-text("${name}")`);
  await page.waitForURL(/\/finance\/students\/.+/);
}
// Waits for the message, since the page re-renders just after the form is sent.
async function expectNotice(page, kind, pattern) {
  await page.locator(`.notice.${kind}`, { hasText: pattern }).first().waitFor({ timeout: 10000 });
}
async function askRefund(page, { amount = "", cancel = false, reason }) {
  await page.fill("#r-amount", amount);
  if (cancel) await page.check('input[name="cancelBalance"]');
  await page.fill("#r-reason", reason);
  await submit(page, 'button:has-text("Send for approval")');
}

test("set-up: Ama and Ben each paid US$100 of US$175, and there is a finance officer", async () => {
  await setUpClass(ctx);
  await makeStaff(ctx, finance, "FINANCE");
});

test("Finance asks for a refund; it cannot be more than was paid, and nothing changes before approval", async () => {
  const fiona = await as(ctx, finance, DESK);
  await statement(fiona, ama.name);
  assert.match(await fiona.locator("form:has(#r-amount)").innerText(), /At most US\$100 can be refunded/);
  await askRefund(fiona, { amount: "500", reason: "Ama has withdrawn after week one." });
  await expectNotice(fiona, "error", /At most US\$100 can be refunded/);
  await askRefund(fiona, { reason: "Ama has withdrawn after week one." });
  await expectNotice(fiona, "error", /Enter an amount to refund, or tick the box/);

  await askRefund(fiona, { amount: "30", cancel: true, reason: "Ama has withdrawn after week one." });
  await expectNotice(fiona, "ok", /sent to academic leadership/);
  const text = await fiona.locator("main").innerText();
  assert.match(text, /A refund request is waiting for approval/);
  assert.match(text, /US\$175\s+charged[\s\S]*US\$100\s+paid and confirmed[\s\S]*US\$75\s+balance/, "nothing changes before approval");
  assert.equal(await fiona.locator("#r-amount").count(), 0, "a second request cannot be sent while one waits");

  // Finance asks; Finance cannot approve.
  await fiona.goto(`${URL_BASE}/admin/approvals`);
  assert.equal(await fiona.locator("article").count(), 0);
  await fiona.context().close();
});

test("academic leadership approves: the rest of the balance is cancelled and the refund is ready to send", async () => {
  const dora = await as(ctx, dean, DESK);
  await dora.goto(`${URL_BASE}/admin/approvals`);
  assert.match(await dora.locator("article").innerText(), /Fiona Finance[\s\S]*Asks to refund US\$30 to Ama Kollie and cancel what is left to pay for QuickBooks[\s\S]*Paid and confirmed: US\$100\. Reason: Ama has withdrawn after week one\./);
  await submit(dora, 'article button[value="APPROVED"]');
  await expectNotice(dora, "ok", /approved/);
  await dora.context().close();

  const fiona = await as(ctx, finance, DESK);
  await statement(fiona, ama.name);
  const text = await fiona.locator("main").innerText();
  assert.match(text, /Paid in full/);
  assert.match(text, /Balance cancelled: Ama has withdrawn after week one\.\s+−US\$105/);
  assert.match(text, /US\$30\s+Ama has withdrawn after week one\.\s+To send/);
  await fiona.goto(`${URL_BASE}/notifications`);
  assert.match(await fiona.locator("main").innerText(), /Refund: approved/);
  await fiona.context().close();
});

test("Finance sends the refund and records it; the student sees it and is told", async () => {
  const fiona = await as(ctx, finance, DESK);
  await fiona.goto(`${URL_BASE}/finance/refunds`);
  assert.match(await fiona.locator("article").innerText(), /US\$30 to Ama Kollie[\s\S]*Approved by Dora Dean/);
  await fiona.fill('article input[name="reference"]', "mp 2711.0042");
  await submit(fiona, 'article button:has-text("Record as sent")');
  await expectNotice(fiona, "ok", /recorded as paid/);
  assert.match(await fiona.locator("table").innerText(), /Ama Kollie\s+US\$30\s+Mobile Money, MP2711\.0042[\s\S]*Dora Dean\s+Fiona Finance/);
  assert.equal(await fiona.locator("article").count(), 0);
  await statement(fiona, ama.name);
  assert.match(await fiona.locator("main").innerText(), /US\$70\s+charged[\s\S]*US\$70\s+paid and confirmed, less refunds[\s\S]*US\$0\s+balance/);
  await fiona.context().close();

  const student = await as(ctx, ama);
  await student.goto(`${URL_BASE}/fees`);
  const text = await student.locator("main").innerText();
  assert.match(text, /Paid in full/);
  assert.match(text, /Refund sent to you on[\s\S]*Mobile Money, MP2711\.0042\s+US\$30/);
  assert.match(text, /Paid and confirmed, less refunds\s+US\$70[\s\S]*Balance\s+US\$0/);
  await student.goto(`${URL_BASE}/notifications`);
  assert.match(await student.locator("main").innerText(), /Refund sent: US\$30/);
  await student.context().close();
});

test("a rejected request changes nothing, and the student cannot reach refund pages", async () => {
  const fiona = await as(ctx, finance, DESK);
  await statement(fiona, ben.name);
  await askRefund(fiona, { cancel: true, reason: "Ben asked to cancel his balance." });
  await expectNotice(fiona, "ok", /sent to academic leadership/);
  await fiona.context().close();

  const dora = await as(ctx, dean, DESK);
  await dora.goto(`${URL_BASE}/admin/approvals`);
  await dora.fill('article input[name="note"]', "Ben is still enrolled; he must pay.");
  await submit(dora, 'article button[value="REJECTED"]');
  await dora.context().close();

  const again = await as(ctx, finance, DESK);
  await statement(again, ben.name);
  assert.match(await again.locator("main").innerText(), /US\$175\s+charged[\s\S]*US\$100\s+paid and confirmed[\s\S]*US\$75\s+balance/);
  await again.context().close();

  const student = await as(ctx, ben);
  await student.goto(`${URL_BASE}/finance/refunds`);
  assert.equal(path(student), "/dashboard");
  await student.context().close();
});

test("the refunds report and the activity log record every step", async () => {
  const admin = await as(ctx, ADMIN, DESK);
  const csv = (await (await admin.request.get(`${URL_BASE}/api/reports/refunds`)).text()).replace(/^﻿/, "").trimEnd().split("\r\n");
  assert.match(csv[0], /^Approved on,Approved by,Student number,Name,Course,Intake,Amount \(USD\),Reason,Sent,Sent on,Method,Reference,Sent by$/);
  assert.equal(csv.length, 2);
  assert.match(csv[1], /^\d{4}-\d{2}-\d{2},Dora Dean,TIME-\d{4}-\d{4},Ama Kollie,QuickBooks,March 2027,30,Ama has withdrawn after week one\.,Yes,\d{4}-\d{2}-\d{2},Mobile Money,MP2711\.0042,Fiona Finance$/);

  await admin.goto(`${URL_BASE}/admin/activity`);
  const log = await admin.locator("table").innerText();
  for (const expected of [
    "Fiona Finance asked to refund US$30 and cancel the rest of the balance for Ama Kollie",
    "A refund of US$30 to Ama Kollie was approved, and US$105 still owed by Ama Kollie was cancelled",
    "Fiona Finance paid Ama Kollie a refund of US$30 by Mobile Money (MP2711.0042)",
    "Dora Dean rejected the refund request from Fiona Finance",
  ]) assert.ok(log.includes(expected), expected);
  assert.deepEqual(admin.problems, []);
  await admin.context().close();
});
