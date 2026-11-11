import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

export const MIN_PASSWORD = 10;

// Shared sign-in setup. The web app adds cookie handling; command-line scripts use it as is.
export function createAuth(plugins: BetterAuthPlugin[] = []) {
  return betterAuth({
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    emailAndPassword: { enabled: true, minPasswordLength: MIN_PASSWORD, maxPasswordLength: 128 },
    user: {
      additionalFields: {
        phone: { type: "string", required: false },
        // Never accepted from a form: only the server changes these.
        role: { type: "string", defaultValue: "STUDENT", input: false },
        status: { type: "string", defaultValue: "ACTIVE", input: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await audit({ actor: user, action: "account.created", summary: `${user.name} created an account`, entityType: "user", entityId: user.id });
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { status: true } });
            if (user?.status === "SUSPENDED") {
              throw new APIError("FORBIDDEN", { message: "This account is suspended. Contact the TIME office." });
            }
          },
          after: async (session) => {
            const user = await prisma.user.findUnique({ where: { id: session.userId } });
            if (user) await audit({ actor: user, action: "auth.signed_in", summary: `${user.name} signed in`, entityType: "user", entityId: user.id });
          },
        },
      },
    },
    plugins,
  });
}
