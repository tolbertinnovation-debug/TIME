import Link from "next/link";
import { redirect } from "next/navigation";
import { signUpAction } from "@/app/actions";
import { Notices } from "@/components/notice";
import { MIN_PASSWORD } from "@/lib/auth-core";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Create account" };

export default async function SignUp({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const params = await searchParams;
  const keep = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");
  return (
    <div className="card auth-card stack">
      <h1>Create your account</h1>
      <p className="muted">Every new account starts as a student account. Staff ask for their role after signing in.</p>
      <Notices params={params} />
      <form className="form" action={signUpAction}>
        <div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" type="text" autoComplete="name" required maxLength={100} defaultValue={keep("name")} /></div>
        <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required defaultValue={keep("email")} /></div>
        <div className="field"><label htmlFor="phone">Phone or WhatsApp <span className="muted">(optional)</span></label><input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={30} placeholder="+231 …" /></div>
        <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD} maxLength={128} aria-describedby="password-hint" /><span className="hint" id="password-hint">At least {MIN_PASSWORD} characters.</span></div>
        <button className="btn" type="submit">Create account</button>
      </form>
      <p className="small muted">Already registered? <Link href="/sign-in">Sign in</Link>.</p>
    </div>
  );
}
