// Phone numbers as a way to sign in, for people without an email address.
//
// A number is stored once in a standard form ("+231777123456") so that "0777 123 456",
// "+231 777 123 456" and "231777123456" are recognised as the same number.

// Liberia's country code. A number written without one is taken to be Liberian.
const LIBERIA = "231";

export function normalisePhone(input: string): string | null {
  let s = input.trim().replace(/[\s().\-/]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (s.startsWith("+")) {
    const digits = s.slice(1);
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  }
  if (!/^\d+$/.test(s)) return null;
  // 231 777 123 456
  if (s.startsWith(LIBERIA) && s.length === 12) return `+${s}`;
  // 0777 123 456: the usual way to write a Liberian mobile number
  if (s.startsWith("0") && s.length === 10) return `+${LIBERIA}${s.slice(1)}`;
  // 777 123 456
  if (/^[2-9]\d{8}$/.test(s)) return `+${LIBERIA}${s}`;
  return null;
}

// The sign-in system needs an email address for every account. An account opened with a phone
// number gets one made from it, on a domain that can never receive mail (".invalid" is reserved
// for exactly this). It is never shown to anyone, and no email is ever sent to it.
const PHONE_DOMAIN = "phone.time-learning.invalid";

export const phoneOnlyEmail = (phoneKey: string) => `${phoneKey.replace(/^\+/, "")}@${PHONE_DOMAIN}`;
export const isPhoneOnlyEmail = (email: string) => email.toLowerCase().endsWith(`@${PHONE_DOMAIN}`);

// The real email address, or null for an account opened with a phone number.
export const realEmail = (email: string) => (isPhoneOnlyEmail(email) ? null : email);

// How to show who someone is and how to reach them: their email, or their phone number if they have no email.
export function contactOf(person: { email: string; phone?: string | null }): string {
  return realEmail(person.email) ?? person.phone ?? "No email or phone";
}

// "+231777123456" shown as "+231 777 123 456".
export function formatPhone(phoneKey: string): string {
  const m = /^\+231(\d{3})(\d{3})(\d{3})$/.exec(phoneKey);
  return m ? `+231 ${m[1]} ${m[2]} ${m[3]}` : phoneKey;
}
