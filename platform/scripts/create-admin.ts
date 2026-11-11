// Creates the first system administrator, or promotes an existing account.
// Usage: ADMIN_NAME="..." ADMIN_EMAIL="..." ADMIN_PASSWORD="..." npm run create-admin
// There is no way to become an administrator from the website itself.
import "dotenv/config";
import { createAuth, MIN_PASSWORD } from "../src/lib/auth-core";
import { audit } from "../src/lib/audit";
import { prisma } from "../src/lib/db";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.ADMIN_NAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email) throw new Error("Set ADMIN_EMAIL.");

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    if (!name || !password || password.length < MIN_PASSWORD) {
      throw new Error(`For a new account set ADMIN_NAME and an ADMIN_PASSWORD of at least ${MIN_PASSWORD} characters.`);
    }
    await createAuth().api.signUpEmail({ body: { name, email, password } });
    user = await prisma.user.findUniqueOrThrow({ where: { email } });
  }
  await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN", status: "ACTIVE" } });
  await audit({ actor: null, action: "user.role_changed", summary: `${user.name} was made a system administrator from the command line`, entityType: "user", entityId: user.id, meta: { from: user.role, to: "ADMIN" } });
  console.log(`${email} is now a system administrator.`);
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
