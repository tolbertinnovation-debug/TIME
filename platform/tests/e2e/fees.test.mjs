import { test } from "node:test";
import assert from "node:assert/strict";
import { ADMIN, DESK, PEOPLE, URL_BASE, as, makeStaff, setUpClass, submit, testDb, useApp } from "./helpers.mjs";

const ctx = useApp();
const { lecturer, dean, registrar, ama, ben } = PEOPLE;
const finance = { name: "Fiona Finance", email: "fiona@example.test", password: "finance-password-1" };
const path = (page) => new URL(page.url()).pathname;
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

let classId;

async function report(page, { amount, method = "MOBILE_MONEY", reference }) {
  await page.goto(`${URL_BASE}/fees`);
  await page.fill("#amount", amount);
  await page.selectOption("#method", method);
  await page.fill("#reference", reference);
  await submit(page, 'button:has-text("Send to Finance")');
}

test("a class is set up, with no payments yet, and a finance officer", async () => {
  classId = await setUpClass(ctx, { pay: false });
  await makeStaff(ctx, finance, "FINANCE");
});

test("enrolment charges the course tuition, and the class stays closed until a first payment is confirmed", async () => {
  const student = await as(ctx, ama);
  assert.match(await student.locator(".notice.error").innerText(), /You owe US\$175 and cannot open a class yet/);
  await student.goto(`${URL_BASE}/learn/${classId}`);
  assert.equal(path(student), "/fees");
  assert.match(await student.locator(".notice.error").innerText(), /cannot open that class yet/);
  const text = await student.locator("main").innerText();
  assert.match(text, /Waiting for first payment/);
  assert.match(text, /Tuition[\s\S]*US\$175[\s\S]*Balance\s+US\$175/);
  assert.match(text, /0888 901 848 \(Lonestar Cell MTN\)/);
  assert.match(text, /Ask the TIME finance office for the bank account details/);
  await student.context().close();
});

test("only finance staff reach the finance area; the finance officer sets the bank details", async () => {
  for (const creds of [ama, lecturer, registrar]) {
    const page = await as(ctx, creds);
    for (const p of ["/finance", "/finance/payments", "/finance/students", "/finance/settings"]) {
      await page.goto(URL_BASE + p);
      assert.equal(path(page), "/dashboard", `${creds.name} ${p}`);
    }
    await page.context().close();
  }
  const fiona = await as(ctx, finance, DESK);
  await fiona.goto(`${URL_BASE}/finance/settings`);
  await fiona.fill("#bank", "Ecobank Liberia, Harbel branch\nAccount name: TIME Inc.\nAccount number: 0012345678");
  await submit(fiona, 'button:has-text("Save payment details")');
  assert.match(await fiona.locator(".notice.ok").innerText(), /saved/);
  // Finance has no way into marks or lessons.
  for (const p of [`/admin/results/${classId}`, "/admin/users", "/admin/activity"]) {
    await fiona.goto(URL_BASE + p);
    assert.equal(path(fiona), "/dashboard", p);
  }
  assert.equal((await fiona.goto(`${URL_BASE}/teach/${classId}/gradebook`)).status(), 404);
  await fiona.context().close();

  const student = await as(ctx, ama);
  await student.goto(`${URL_BASE}/fees`);
  assert.match(await student.locator("main").innerText(), /Ecobank Liberia, Harbel branch[\s\S]*0012345678/);
  await student.context().close();
});

test("a reported payment does not count until finance confirms it, and one transaction cannot be used twice", async () => {
  const student = await as(ctx, ama);
  await report(student, { amount: "abc", reference: "MP2611.0412.A" });
  assert.match(await student.locator(".notice.error").innerText(), /amount in US dollars/);
  await report(student, { amount: "87.50", reference: "mp 2611.0412.a" });
  assert.match(await student.locator(".notice.ok").innerText(), /finance office will check/);
  const text = await student.locator("main").innerText();
  assert.match(text, /US\$87\.50\s+Mobile Money\s+MP2611\.0412\.A\s+Waiting for Finance/);
  assert.match(text, /Balance\s+US\$175/, "the balance has not changed yet");
  await student.goto(`${URL_BASE}/learn/${classId}`);
  assert.equal(path(student), "/fees", "still closed");
  await student.context().close();

  const other = await as(ctx, ben);
  await report(other, { amount: "87.50", reference: "MP2611.0412.A" });
  assert.match(await other.locator(".notice.error").innerText(), /already been reported/);
  await other.context().close();
});

test("finance confirms the payment: a receipt is issued, the balance drops and the class opens", async () => {
  const fiona = await as(ctx, finance, DESK);
  assert.match(await fiona.locator('a.tile[href="/admin/approvals"]').innerText(), /^0\b/);
  await fiona.goto(`${URL_BASE}/finance`);
  assert.match(await fiona.locator('a.tile[href="/finance/payments"]').innerText(), /^1\b/);
  await fiona.goto(`${URL_BASE}/finance/payments`);
  assert.match(await fiona.locator("article").innerText(), /US\$87\.50[\s\S]*Reference: MP2611\.0412\.A[\s\S]*Ama Kollie/);
  await submit(fiona, 'button:has-text("Confirm payment")');
  assert.match(await fiona.locator(".notice.ok").innerText(), /Receipt R-000001 was issued to Ama Kollie/);
  assert.equal(await fiona.locator("article").count(), 0);
  await fiona.context().close();

  const student = await as(ctx, ama);
  await student.goto(`${URL_BASE}/fees`);
  const text = await student.locator("main").innerText();
  assert.match(text, /Balance to pay/);
  assert.match(text, /You owe US\$87\.50, due by .* \(8 weeks after your first payment\)\. 5[5-7] days left/);
  await student.click('a:has-text("Receipt R-000001")');
  await student.waitForURL(/\/fees\/receipt\//);
  const receiptUrl = student.url();
  assert.match(await student.locator("article").innerText(), /Receipt R-000001[\s\S]*Ama Kollie[\s\S]*US\$87\.50[\s\S]*Mobile Money, reference MP2611\.0412\.A[\s\S]*Fiona Finance/);
  assert.equal((await student.goto(`${URL_BASE}/learn/${classId}`)).status(), 200, "the class is open");
  await student.context().close();

  const other = await as(ctx, ben);
  assert.equal((await other.goto(receiptUrl)).status(), 404, "another student cannot open the receipt");
  await other.context().close();
});

test("finance rejects a payment with a reason; the student sees it and can report it again", async () => {
  const student = await as(ctx, ben);
  await report(student, { amount: "50", method: "BANK_TRANSFER", reference: "ECO-778812" });
  const fiona = await as(ctx, finance, DESK);
  await fiona.goto(`${URL_BASE}/finance/payments`);
  await fiona.fill('input[name="reason"]', "The bank statement shows US$40, not US$50.");
  await submit(fiona, 'button:has-text("Reject")');
  assert.match(await fiona.locator(".notice.ok").innerText(), /rejected/);

  await student.goto(`${URL_BASE}/fees`);
  assert.match(await student.locator("main").innerText(), /Rejected\s+The bank statement shows US\$40, not US\$50\./);
  await report(student, { amount: "40", method: "BANK_TRANSFER", reference: "ECO-778812" });
  assert.match(await student.locator(".notice.ok").innerText(), /finance office will check/);
  await fiona.goto(`${URL_BASE}/finance/payments`);
  await submit(fiona, 'button:has-text("Confirm payment")');
  assert.match(await fiona.locator(".notice.ok").innerText(), /Receipt R-000002/);

  // An extra charge raises the balance.
  await fiona.goto(`${URL_BASE}/finance/students?q=Ben`);
  await fiona.click('tbody a:has-text("Ben Dolo")');
  await fiona.waitForURL(/\/finance\/students\/.+/);
  await fiona.selectOption("#c-kind", "EXAM");
  await fiona.fill("#c-desc", "Exit examination");
  await fiona.fill("#c-amount", "15");
  await submit(fiona, 'button:has-text("Add charge")');
  assert.match(await fiona.locator("main").innerText(), /Owes US\$150[\s\S]*US\$190\s+charged[\s\S]*US\$40\s+paid and confirmed/);
  await fiona.context().close();
  await student.context().close();
});

test("after 8 weeks an unpaid balance pauses access; approved extra time restores it; paying clears it", async () => {
  // Move Ama's first payment 60 days into the past.
  await testDb(`UPDATE payment SET "paidOn" = (now() - interval '60 days')::date WHERE reference = 'MP2611.0412.A'`);
  const student = await as(ctx, ama);
  assert.match(await student.locator(".notice.error").innerText(), /You owe US\$87\.50 and cannot open a class yet/);
  await student.goto(`${URL_BASE}/learn/${classId}`);
  assert.equal(path(student), "/fees");
  assert.match(await student.locator("article").innerText(), /Overdue: access paused[\s\S]*access to this class is paused/);

  await student.click('summary:has-text("Ask for more time to pay")');
  await student.fill('input[name="until"]', inDays(14));
  await student.fill('textarea[name="note"]', "My salary is delayed this month. I will pay the balance on the 28th.");
  await submit(student, 'button:has-text("Send request")');
  assert.match(await student.locator("main").innerText(), /request for more time is waiting/);

  const fiona = await as(ctx, finance, DESK);
  await fiona.goto(`${URL_BASE}/admin/approvals`);
  assert.equal(await fiona.locator("article").count(), 1, "finance sees only requests for more time");
  assert.match(await fiona.locator("article").innerText(), /Ama Kollie[\s\S]*to pay a balance of US\$87\.50 for QuickBooks/);
  await submit(fiona, 'button[value="APPROVED"]');

  await student.goto(`${URL_BASE}/fees`);
  assert.match(await student.locator("article").innerText(), /More time approved[\s\S]*has given you until/);
  assert.equal((await student.goto(`${URL_BASE}/learn/${classId}`)).status(), 200, "access is back");

  await fiona.goto(`${URL_BASE}/finance/students?show=owing&q=Ama`);
  await fiona.click('tbody a:has-text("Ama Kollie")');
  await fiona.waitForURL(/\/finance\/students\/.+/);
  await fiona.fill("#p-amount", "87.50");
  await fiona.selectOption("#p-method", "BANK_TRANSFER");
  await fiona.fill("#p-ref", "ECO-990031");
  await submit(fiona, 'button:has-text("Record payment")');
  assert.match(await fiona.locator(".notice.ok").innerText(), /Receipt R-000003/);
  await student.goto(`${URL_BASE}/fees`);
  assert.match(await student.locator("article").innerText(), /Paid in full[\s\S]*Everything is paid/);
  await fiona.context().close();
  await student.context().close();
});

test("leadership can see finance but not change it, and every money action is in the activity log", async () => {
  const dora = await as(ctx, dean, DESK);
  await dora.goto(`${URL_BASE}/finance/students`);
  assert.equal(path(dora), "/finance/students");
  await dora.click('tbody a:has-text("Ben Dolo")');
  await dora.waitForURL(/\/finance\/students\/.+/);
  assert.equal(await dora.locator('button:has-text("Record payment"), button:has-text("Add charge")').count(), 0);
  await dora.goto(`${URL_BASE}/finance/settings`);
  assert.equal(path(dora), "/dashboard");
  await dora.context().close();

  const admin = await as(ctx, ADMIN, DESK);
  await admin.goto(`${URL_BASE}/admin/activity?group=payment`);
  const payments = await admin.locator("table").innerText();
  for (const expected of [
    "Ama Kollie reported a Mobile Money payment of US$87.50 (MP2611.0412.A) for QuickBooks",
    "Fiona Finance confirmed Ama Kollie's Mobile Money payment of US$87.50 (MP2611.0412.A). Receipt R-000001",
    "Fiona Finance rejected Ben Dolo's reported payment of US$50 (ECO-778812). Reason: The bank statement shows US$40, not US$50.",
    "Fiona Finance recorded Ama Kollie's Bank transfer payment of US$87.50 (ECO-990031). Receipt R-000003",
  ]) assert.ok(payments.includes(expected), expected);
  await admin.goto(`${URL_BASE}/admin/activity`);
  const all = await admin.locator("table").innerText();
  for (const expected of [
    "Fiona Finance changed the payment details shown to students",
    "Fiona Finance charged Ben Dolo US$15: Examination fee, Exit examination",
    `Ama Kollie was given until ${inDays(14)} to pay their balance`,
  ]) assert.ok(all.includes(expected), expected);
  assert.deepEqual(admin.problems, []);
  await admin.context().close();
});
