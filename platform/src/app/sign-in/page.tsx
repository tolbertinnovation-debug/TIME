import Link from "next/link";
import { redirect } from "next/navigation";
import { signInAction } from "@/app/actions";
import { Notices } from "@/components/notice";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Sign in" };

export default async function SignIn({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const params = await searchParams;
  return (
    <div className="card auth-card stack">
      <h1>Sign in</h1>
      <Notices params={params} />
      <form className="form" action={signInAction}>
        <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required defaultValue={typeof params.email === "string" ? params.email : ""} /></div>
        <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
        <button className="btn" type="submit">Sign in</button>
      </form>
      <p className="small muted">New to TIME Learning? <Link href="/sign-up">Create an account</Link>.</p>
    </div>
  );
}
