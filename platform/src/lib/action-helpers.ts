import { redirect } from "next/navigation";
import type { z } from "zod";

// Send the person back to a page with a message shown at the top.
export function back(path: string, kind: "error" | "ok", message: string, extra: Record<string, string> = {}): never {
  const q = new URLSearchParams({ [kind]: message, ...extra });
  redirect(`${path}${path.includes("?") ? "&" : "?"}${q}`);
}

export const firstProblem = (error: z.ZodError) => error.issues[0]?.message ?? "Please check the form.";

// A problem the person can fix, raised inside a database transaction.
export class UserProblem extends Error {}
