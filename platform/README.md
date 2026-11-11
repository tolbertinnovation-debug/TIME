# TIME Learning platform

The online learning platform for TIME Inc. It is separate from the public website in the folder above, and it needs its own hosting and database to go live.

- Plan and progress: [`docs/PLAN.md`](docs/PLAN.md). **Step 1 (foundation) is built.**
- Stack: Next.js (App Router, TypeScript), Prisma, PostgreSQL (Neon in production), Better Auth.

## Run it on your computer

You need Node 22 or later and PostgreSQL.

```sh
cd platform
cp .env.example .env          # then set DATABASE_URL and a long random BETTER_AUTH_SECRET
npm install
npm run db:deploy             # create the tables
npm run db:seed               # load TIME's schools, programs and courses
ADMIN_NAME="Your Name" ADMIN_EMAIL="you@example.com" ADMIN_PASSWORD="a-long-password" npm run create-admin
npm run dev                   # http://localhost:3000
```

The first administrator can only be created with `npm run create-admin`. Nobody can become an administrator from the website.

## Tests

```sh
npm run typecheck
npm test                      # permission rules
npm run build && npm run test:e2e   # the full flow in a real browser
```

The browser tests empty and refill a database named `time_test` on your own computer (or `TEST_DATABASE_URL`). They refuse to run against any database whose name does not end in `_test`.

## How it is organised

| Path | What it holds |
|---|---|
| `prisma/schema.prisma` | The database design. Change it, then run `npm run db:migrate`. |
| `prisma/seed.ts` | Loads the catalogue from `../data/catalogue.json`. Safe to run again. |
| `src/lib/permissions.ts` | Who may do what. Every page and action checks these rules on the server. |
| `src/lib/audit.ts` | Writes the activity log. Call it for every change that matters. |
| `src/lib/auth-core.ts`, `auth.ts`, `session.ts` | Sign-in, and finding the signed-in person. |
| `src/app/actions.ts` | Every change a person can make (sign up, request, approve, change role, suspend). |
| `src/app/admin/` | Administration: overview, accounts, approvals, activity. |

## Security notes

- Roles and account status are never read from a form. Only the server changes them.
- A person's role is read from the database on every request, so a role change or suspension applies at once.
- Suspending an account signs the person out everywhere.
- Two people can never decide the same approval, and nobody can decide their own request.
- Never commit `.env`. Production secrets belong in the hosting provider's settings.
- Not built yet: email verification and self-service password reset (they need an email service; see the plan).
