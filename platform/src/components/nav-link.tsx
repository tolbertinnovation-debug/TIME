"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// A menu link that marks itself as the current page.
export function NavLink({ href, exact = false, children }: { href: string; exact?: boolean; children: React.ReactNode }) {
  const path = usePathname();
  const current = exact ? path === href : path === href || path.startsWith(`${href}/`);
  return <Link href={href} aria-current={current ? "page" : undefined}>{children}</Link>;
}
