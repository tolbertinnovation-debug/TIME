import { test } from "node:test";
import assert from "node:assert/strict";
import { ADMIN, DESK, URL_BASE, as, person, signIn, signUp, submit, useApp } from "./helpers.mjs";

const ctx = useApp();
const ama = { name: "Ama Kollie", email: "ama@example.test", password: "student-password-1" };
const NEW = "a-sentence-only-ama-knows";
const PAGE = `${URL_BASE}/account/settings`;

async function change(page, current, next, repeat = next) {
  await page.goto(PAGE);
  await page.fill("#current", current);
  await page.fill("#next", next);
  await page.fill("#repeat", repeat);
  await submit(page, 'button:has-text("Change password")');
}
const notice = async (page, kind) => page.locator(`.notice.${kind}`).innerText();

test("a person opens their account from the menu and saves a phone number", async () => {
  const page = await person(ctx);
  await signUp(page, ama);
  await page.click('a.who:has-text("Ama Kollie")');
  await page.waitForURL("**/account/settings");
  assert.match(await page.locator("main").innerText(), /Ama Kollie[\s\S]*ama@example\.test[\s\S]*Student/);

  await page.fill("#phone", "call me maybe");
  await submit(page, 'button:has-text("Save phone number")');
  assert.match(await notice(page, "error"), /Enter a phone number using digits/);
  await page.fill("#phone", "+231 777 123 456");
  await submit(page, 'button:has-text("Save phone number")');
  assert.match(await notice(page, "ok"), /phone number has been saved/);
  await page.goto(`${URL_BASE}/dashboard`);
  assert.match(await page.locator("main").innerText(), /ama@example\.test · \+231 777 123 456/);
  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test("changing the password checks the form and the current password", async () => {
  const page = await as(ctx, ama);
  await change(page, ama.password, NEW, "something-else-entirely");
  assert.match(await notice(page, "error"), /two new passwords are not the same/);
  await change(page, ama.password, ama.password);
  assert.match(await notice(page, "error"), /must be different/);
  await change(page, "not-my-password", NEW);
  assert.match(await notice(page, "error"), /current password is not correct/);
  await page.context().close();
});

test("a new password works, the old one stops, and other devices are signed out", async () => {
  const phone = await as(ctx, ama);
  const laptop = await as(ctx, ama, DESK);
  await change(laptop, ama.password, NEW);
  assert.match(await notice(laptop, "ok"), /password has been changed/);
  // The device that changed it stays signed in.
  await laptop.goto(`${URL_BASE}/dashboard`);
  assert.equal(new URL(laptop.url()).pathname, "/dashboard");
  // Every other device is signed out.
  await phone.goto(`${URL_BASE}/dashboard`);
  assert.equal(new URL(phone.url()).pathname, "/sign-in");

  await signIn(phone, ama);
  assert.equal(new URL(phone.url()).pathname, "/sign-in", "the old password no longer works");
  await signIn(phone, { ...ama, password: NEW });
  assert.equal(new URL(phone.url()).pathname, "/dashboard");
  await phone.context().close();
  await laptop.context().close();
});

test("five wrong current passwords lock password changes for ten minutes", async () => {
  const page = await as(ctx, { ...ama, password: NEW });
  // One wrong password was already entered in the earlier test, so four more make five.
  for (let i = 0; i < 4; i++) {
    await change(page, `wrong-password-${i}`, "another-new-password");
    assert.match(await notice(page, "error"), /not correct/);
  }
  await change(page, NEW, "another-new-password");
  assert.match(await notice(page, "error"), /Too many wrong passwords/);
  await page.context().close();
});

test("an administrator can now change their own password, and every change is in the activity log", async () => {
  const admin = await as(ctx, ADMIN, DESK);
  await change(admin, ADMIN.password, "admin-password-456");
  assert.match(await notice(admin, "ok"), /password has been changed/);
  await admin.goto(`${URL_BASE}/admin/activity`);
  const log = await admin.locator("table").innerText();
  for (const expected of [
    "Ama Kollie updated their phone number",
    "Ama Kollie changed their password",
    "Ama Kollie entered a wrong current password while changing their password",
    "Test Admin changed their password",
  ]) assert.ok(log.includes(expected), expected);
  assert.ok(!log.includes(NEW) && !log.includes("777 123 456"), "passwords and phone numbers are never written to the log");
  await admin.context().close();
});
