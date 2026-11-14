import Link from "next/link";
import { notFound } from "next/navigation";
import { resetPasswordAction } from "@/app/academic-actions";
import { Notices } from "@/components/notice";
import { MIN_PASSWORD } from "@/lib/auth-core";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";

export const metadata = { title: "Set a new password" };

export default async function ResetPassword({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireCapability("users.resetPassword");
  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.id === me.id) notFound();
  return (
    <div className="stack lg" style={{ maxWidth: 520 }}>
      <div className="stack">
        <p className="small"><Link href="/admin/users">Accounts</Link></p>
        <h1>Set a new password</h1>
        <p className="muted">For <strong>{target.name}</strong> ({target.email}). Check who you are speaking to first. The person is signed out everywhere, and this is recorded in the activity log.</p>
        <Notices params={await searchParams} />
      </div>
      <form className="card form" action={resetPasswordAction}>
        <input type="hidden" name="userId" value={target.id} />
        <div className="field">
          <label htmlFor="password">New password</label>
          <input id="password" name="password" type="text" autoComplete="off" required minLength={MIN_PASSWORD} maxLength={128} aria-describedby="password-hint" />
          <span className="hint" id="password-hint">At least {MIN_PASSWORD} characters. Give it to the person in private.</span>
        </div>
        <button className="btn" type="submit">Set password</button>
      </form>
    </div>
  );
}
