import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import { signOutAction } from "@/app/actions";
import { NavLink } from "@/components/nav-link";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

const body = localFont({ src: "../fonts/dm-sans-latin.woff2", weight: "400 700", variable: "--font-body", display: "swap" });
const display = localFont({ src: "../fonts/manrope-latin.woff2", weight: "500 800", variable: "--font-display", display: "swap" });
// Used only for the holder's name on certificates, so it is not preloaded on every page.
const blackletter = localFont({ src: "../fonts/unifrakturcook-latin-700.woff2", weight: "700", variable: "--font-blackletter", display: "swap", preload: false });

export const metadata: Metadata = {
  title: { default: "TIME Learning", template: "%s | TIME Learning" },
  description: "The online learning platform of the Technical Institute for Many Empowerment (TIME) Inc., Liberia.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#435e25" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const unread = user ? await prisma.notification.count({ where: { userId: user.id, readAt: null } }) : 0;
  return (
    <html lang="en" className={`${body.variable} ${display.variable} ${blackletter.variable}`}>
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
                  <NavLink href="/dashboard">Home</NavLink>
                  {can(user.role, "classes.apply") && <NavLink href="/my-classes">My classes</NavLink>}
                  {can(user.role, "classes.apply") && <NavLink href="/fees">Fees</NavLink>}
                  {can(user.role, "classes.apply") && <NavLink href="/certificates">Certificates</NavLink>}
                  {can(user.role, "classes.apply") && <NavLink href="/apply">Apply</NavLink>}
                  {can(user.role, "finance.view") && <NavLink href="/finance">Finance</NavLink>}
                  {(user.role === "LECTURER" || user.role === "FACILITATOR") && <NavLink href="/teach">My classes</NavLink>}
                  <NavLink href="/catalogue">Programs</NavLink>
                  {can(user.role, "admin.area") && <NavLink href="/admin">Administration</NavLink>}
                  <NavLink href="/help">Help</NavLink>
                  <NavLink href="/notifications">Notifications{unread > 0 ? <span className="pill bad" style={{ marginLeft: 6 }}>{unread}<span className="skip"> unread</span></span> : null}</NavLink>
                </nav>
                <span className="who">{user.name} · {ROLE_LABEL[user.role]}</span>
                <form action={signOutAction}><button className="btn ghost sm" type="submit">Sign out</button></form>
              </>
            ) : (
              <nav className="nav" aria-label="Main">
                <NavLink href="/verify">Check a certificate</NavLink>
                <NavLink href="/sign-in">Sign in</NavLink>
                <NavLink href="/sign-up">Create account</NavLink>
              </nav>
            )}
          </div>
        </header>
        <main id="main"><div className="wrap">{children}</div></main>
      </body>
    </html>
  );
}
