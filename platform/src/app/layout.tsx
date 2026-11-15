import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import { signOutAction } from "@/app/actions";
import { NavLink } from "@/components/nav-link";
import { OfflineSupport } from "@/components/offline";
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
export const viewport: Viewport = { themeColor: "#435e25", width: "device-width", initialScale: 1 };

// TIME's public website, linked from the footer so students can find their way back.
const WEBSITE = "https://tolbertinnovation-debug.github.io/TIME/";

// "Ama Kollie" -> "AK", for the round badge beside a person's name.
function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const unread = user ? await prisma.notification.count({ where: { userId: user.id, readAt: null } }) : 0;
  return (
    <html lang="en" className={`${body.variable} ${display.variable} ${blackletter.variable}`}>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <header className="site-header">
          <div className="wrap topbar">
            <Link className="brand" href={user ? "/dashboard" : "/sign-in"}>
              <Image src="/logo.png" alt="" width={40} height={40} priority />
              <span className="brand-text">
                <span className="brand-name">TIME Learning</span>
                <span className="brand-sub">Technical Institute for Many Empowerment</span>
              </span>
            </Link>
            {user ? (
              <div className="account">
                <Link className="who" href="/account/settings" title="Your account">
                  <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
                  <span className="who-text"><span className="who-name">{user.name}</span><span className="who-role">{ROLE_LABEL[user.role]}</span></span>
                </Link>
                <form action={signOutAction}><button className="btn ghost sm" type="submit">Sign out</button></form>
              </div>
            ) : (
              <nav className="nav nav-public" aria-label="Main">
                <NavLink href="/verify">Check a certificate</NavLink>
                <NavLink href="/sign-in">Sign in</NavLink>
                <NavLink href="/sign-up">Create account</NavLink>
              </nav>
            )}
          </div>
          {user && (
            <div className="navbar">
              <nav className="wrap nav" aria-label="Main">
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
                <NavLink href="/notifications">Notifications{unread > 0 ? <span className="count">{unread}<span className="skip"> unread</span></span> : null}</NavLink>
              </nav>
            </div>
          )}
        </header>
        <main id="main"><div className="wrap"><OfflineSupport signedIn={Boolean(user)} />{children}</div></main>
        <footer className="site-footer no-print">
          <div className="wrap footer-inner">
            <div>
              <strong>Technical Institute for Many Empowerment (TIME) Inc.</strong>
              <p>Mid-Liberia Christian School System, Ben&apos;s Town Community, Marshall Education District, Margibi County, Liberia</p>
            </div>
            <nav className="footer-links" aria-label="Footer">
              <a href={WEBSITE}>TIME Inc. website</a>
              <Link href="/verify">Check a certificate</Link>
              {user && <Link href="/help">Help</Link>}
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
