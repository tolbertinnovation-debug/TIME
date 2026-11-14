import Link from "next/link";
import { changePasswordAction, updatePhoneAction } from "@/app/account-actions";
import { Notices } from "@/components/notice";
import { MIN_PASSWORD } from "@/lib/auth-core";
import { ROLE_LABEL } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Your account" };

export default async function AccountSettings({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  return (
    <div className="stack lg" style={{ maxWidth: 560 }}>
      <div className="stack">
        <h1>Your account</h1>
        <Notices params={await searchParams} />
      </div>

      <section className="card stack" aria-labelledby="details-h">
        <h2 id="details-h">Your details</h2>
        <div className="table-wrap"><table><tbody>
          <tr><th scope="row">Name</th><td>{user.name}</td></tr>
          <tr><th scope="row">Email</th><td>{user.email}</td></tr>
          <tr><th scope="row">Role</th><td>{ROLE_LABEL[user.role]}</td></tr>
        </tbody></table></div>
        <p className="small muted">Your name appears on your certificate, so only the Registrar can change it. To correct your name or email, <Link href="/help">ask through Help</Link>.</p>
        <form className="form" action={updatePhoneAction}>
          <div className="field">
            <label htmlFor="phone">Phone number</label>
            <input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={user.phone ?? ""} maxLength={30} />
            <p className="small muted">So that TIME can reach you about your classes and fees. Leave it empty to remove it.</p>
          </div>
          <div><button className="btn ghost" type="submit">Save phone number</button></div>
        </form>
      </section>

      <section className="card stack" aria-labelledby="password-h">
        <h2 id="password-h">Change your password</h2>
        <p className="small muted">If an administrator gave you a password, change it here to one only you know. Changing it signs you out on every other phone or computer.</p>
        <form className="form" action={changePasswordAction}>
          <div className="field"><label htmlFor="current">Current password</label><input id="current" name="current" type="password" autoComplete="current-password" required /></div>
          <div className="field"><label htmlFor="next">New password</label><input id="next" name="next" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD} maxLength={128} /><p className="small muted">At least {MIN_PASSWORD} characters. A short sentence you can remember works well.</p></div>
          <div className="field"><label htmlFor="repeat">New password again</label><input id="repeat" name="repeat" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD} maxLength={128} /></div>
          <div><button className="btn" type="submit">Change password</button></div>
        </form>
      </section>
    </div>
  );
}
