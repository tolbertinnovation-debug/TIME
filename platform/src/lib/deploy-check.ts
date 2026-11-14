// Settings the live platform cannot run without. Checked before every live deployment (scripts/deploy.ts).
export const MIN_SECRET = 32;
const PLACEHOLDER_SECRETS = ["change-me", "test-secret-0123456789-0123456789", "ci-only-secret-0123456789-0123456789"];

export function deployProblems(env: Record<string, string | undefined>): string[] {
  const problems: string[] = [];
  const db = env.DATABASE_URL ?? "";
  if (!db) problems.push("DATABASE_URL is not set. Paste the connection string from the database provider.");
  else if (!/^postgres(ql)?:\/\//.test(db)) problems.push("DATABASE_URL must start with postgresql://");
  // ALLOW_LOCAL_DATABASE=1 is for a server that runs its own database, and for trying this script out.
  else if (/@(localhost|127\.0\.0\.1)[:/]/.test(db) && env.ALLOW_LOCAL_DATABASE !== "1") problems.push("DATABASE_URL points at this computer (localhost). Use the live database's connection string.");

  const secret = env.BETTER_AUTH_SECRET ?? "";
  if (!secret) problems.push("BETTER_AUTH_SECRET is not set. Use a random password of 40 or more characters.");
  else if (PLACEHOLDER_SECRETS.includes(secret)) problems.push("BETTER_AUTH_SECRET is still an example value. Use a new random password of 40 or more characters.");
  else if (secret.length < MIN_SECRET) problems.push(`BETTER_AUTH_SECRET is too short. Use at least ${MIN_SECRET} characters.`);

  const url = env.BETTER_AUTH_URL;
  if (url && !/^https:\/\//.test(url)) problems.push("BETTER_AUTH_URL must start with https://");
  return problems;
}

// The platform's public address: the one set by hand, or the one the host reports.
export function publicUrl(env: Record<string, string | undefined>): string | undefined {
  if (env.BETTER_AUTH_URL) return env.BETTER_AUTH_URL;
  if (env.VERCEL_PROJECT_PRODUCTION_URL && env.VERCEL_ENV === "production") return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return undefined;
}
