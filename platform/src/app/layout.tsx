import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import { signOutAction } from "@/app/actions";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";

const body = localFont({ src: "../fonts/dm-sans-latin.woff2", weight: "400 700", variable: "--font-body", display: "swap" });
const display = localFont({ src: "../fonts/manrope-latin.woff2", weight: "500 800", variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: { default: "TIME Learning", template: "%s | TIME Learning" },
  description: "The online learning platform of the Technical Institute for Many Empowerment (TIME) Inc., Liberia.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#435e25" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <header className="site-header">
          <div className="wrap">
            <Link className="brand" href={user ? "/dashboard" : "/sign-in"}>
              <Image src="/logo.png" alt="" width={36} height={36} priority />
              TIME Learning
            </Link>
            {user ? (
              <>
                <nav className="nav" aria-label="Main">
                  <Link href="/dashboard">Home</Link>
                  <Link href="/catalogue">Programs</Link>
                  {can(user.role, "admin.area") && <Link href="/admin">Administration</Link>}
                </nav>
                <span className="who">{user.name} · {ROLE_LABEL[user.role]}</span>
                <form action={signOutAction}><button className="btn ghost sm" type="submit">Sign out</button></form>
              </>
            ) : (
              <nav className="nav" aria-label="Main">
                <Link href="/sign-in">Sign in</Link>
                <Link href="/sign-up">Create account</Link>
              </nav>
            )}
          </div>
        </header>
        <main id="main"><div className="wrap">{children}</div></main>
      </body>
    </html>
  );
}
