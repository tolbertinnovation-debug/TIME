import { test } from "node:test";
import assert from "node:assert/strict";
import { ADMIN, DESK, URL_BASE, as, person, signIn, submit, useApp } from "./helpers.mjs";

const ctx = useApp();
const path = (page) => new URL(page.url()).pathname;
const musu = { name: "Musu Kamara", phone: "0777 555 111", password: "musu-password-1" };
const ama = { name: "Ama Kollie", email: "ama@example.test", password: "student-password-1" };

async function signUpWith(page, { name, email = "", phone = "", password }) {
  await page.goto(`${URL_BASE}/sign-up`);
  await page.fill("#name", name);
  await page.fill("#email", email);
  await page.fill("#phone", phone);
  await page.fill("#password", password);
  await submit(page, "form.form button[type=submit]");
}
const login = (page, id, password) => signIn(page, { email: id, password });
const notice = async (page, kind, text) => page.locator(`.notice.${kind}`, { hasText: text }).first().waitFor({ timeout: 10000 });

test("a student without email signs up with a phone number", async () => {
  const page = await person(ctx);
  await signUpWith(page, { name: musu.name, password: musu.password });
  await notice(page, "error", "Enter your email address or your phone number.");
  await signUpWith(page, { name: musu.name, phone: "call me", password: musu.password });
  await notice(page, "error", "Enter a phone number using digits");

  await signUpWith(page, musu);
  assert.equal(path(page), "/dashboard");
  assert.match(await page.locator("main").innerText(), /Musu Kamara\s+\+231 777 555 111/);
  await page.goto(`${URL_BASE}/account/settings`);
  assert.match(await page.locator("main").innerText(), /Email\s+None\. You sign in with your phone number\./);
  assert.ok(!(await page.content()).includes("phone.time-learning.invalid"), "the hidden address is never shown");
  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test("the number signs in however it is written, and cannot open a second account", async () => {
  for (const written of ["0777 555 111", "+231 777 555 111", "231777555111"]) {
    const page = await person(ctx);
    await login(page, written, musu.password);
    assert.equal(path(page), "/dashboard", written);
    await page.context().close();
  }
  const page = await person(ctx);
  await login(page, "0777 555 111", "not-her-password");
  await notice(page, "error", "That phone number or password is not correct.");
  await login(page, "0888 000 000", musu.password);
  await notice(page, "error", "That phone number or password is not correct.");
  await signUpWith(page, { name: "Someone Else", phone: "+231-777-555-111", password: "another-password-1" });
  await notice(page, "error", "An account with that phone number already exists.");
  await page.context().close();
});

test("a phone-only account cannot remove its number, but can change it", async () => {
  const page = await as(ctx, { email: musu.phone, password: musu.password });
  await page.goto(`${URL_BASE}/account/settings`);
  await page.fill("#phone", "");
  await submit(page, 'button:has-text("Save phone number")');
  await notice(page, "error", "cannot be removed");
  await page.fill("#phone", "0886 222 333");
  await submit(page, 'button:has-text("Save phone number")');
  await notice(page, "ok", "You can also sign in with it.");
  await page.context().close();

  const old = await person(ctx);
  await login(old, musu.phone, musu.password);
  assert.equal(path(old), "/sign-in", "the old number no longer signs in");
  await login(old, "0886 222 333", musu.password);
  assert.equal(path(old), "/dashboard");
  await old.context().close();
});

test("a student with email adds a phone number and can then sign in with either; numbers stay unique", async () => {
  const page = await person(ctx);
  await signUpWith(page, ama);
  await page.goto(`${URL_BASE}/account/settings`);
  await page.fill("#phone", "0886 222 333");
  await submit(page, 'button:has-text("Save phone number")');
  await notice(page, "error", "belongs to another account");
  await page.fill("#phone", "+231 770 999 888");
  await submit(page, 'button:has-text("Save phone number")');
  await notice(page, "ok", "saved");
  await page.context().close();

  const byPhone = await person(ctx);
  await login(byPhone, "0770999888", ama.password);
  assert.equal(path(byPhone), "/dashboard");
  assert.match(await byPhone.locator("main").innerText(), /ama@example\.test · \+231 770 999 888/);
  await byPhone.context().close();
});

test("wrong passwords count together whether the email or the phone number is used", async () => {
  const page = await person(ctx);
  for (let i = 0; i < 3; i++) { await login(page, ama.email, `wrong-${i}`); await notice(page, "error", "not correct"); }
  for (let i = 0; i < 2; i++) { await login(page, "0770 999 888", `wrong-phone-${i}`); await notice(page, "error", "not correct"); }
  await login(page, "0770 999 888", ama.password);
  await notice(page, "error", "Too many failed attempts");
  await login(page, ama.email, ama.password);
  await notice(page, "error", "Too many failed attempts");
  await page.context().close();
});

test("staff find a phone-only student by number, and see the number, never the hidden address", async () => {
  const admin = await as(ctx, ADMIN, DESK);
  await admin.goto(`${URL_BASE}/admin/users?q=${encodeURIComponent("0886 222 333")}`);
  const rows = await admin.locator("tbody tr").allInnerTexts();
  assert.equal(rows.length, 1);
  assert.match(rows[0], /Musu Kamara\s+\+231 886 222 333/);
  for (const where of ["/admin/users", "/admin/activity"]) {
    await admin.goto(URL_BASE + where);
    assert.ok(!(await admin.content()).includes("phone.time-learning.invalid"), where);
  }
  assert.deepEqual(admin.problems, []);
  await admin.context().close();
});
