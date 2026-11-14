# Putting TIME Learning online (Neon and Vercel)

This is the route TIME used on 14 November 2026. Follow it if the platform ever has to be set up again, for example in a new Vercel account.

**Never put a password, key or connection string in an email, a chat or this repository.** They go only into Vercel's settings.

## Before you start

- On GitHub, the TIME repository's **default branch must be `main`** (Settings, General, Default branch). Vercel imports the default branch; an old branch without the `platform` folder only publishes the website.
- A Vercel account signed in with **Continue with GitHub**, using the account that owns the TIME repository.
- A password manager.

## 1. Create the project (Vercel)

1. Choose **Add New**, then **Project**, and import `TIME`. Check that "Importing from GitHub" shows `main`.
2. **Project Name:** `time-learning`.
3. **Root Directory:** choose `platform`. The **Application Preset** changes to **Next.js**; if not, pick it.
4. **Environment Variables:** add `BETTER_AUTH_SECRET`, a new random password of 40 or more letters and numbers. Keep a copy in the password manager.
5. Do **not** add the "Prisma Postgres" integration offered on that page.
6. Choose **Create Project**. There is no need to deploy yet: without a database the deployment stops.

## 2. Add the database (Neon, from Vercel)

1. In the project, open **Storage**, choose **Create Database**, then **Neon**.
2. Pick a region in Europe (the closest to Liberia) and connect it to `time-learning` for all environments, with **no custom prefix**.
3. Vercel adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. The platform uses the second for table changes.

## 3. Deploy

Open **Deployments** and redeploy, or merge any change into `main`. The build log shows lines starting with `[TIME Learning]`:

1. It checks the settings. If one is missing or unsafe, the deployment stops and says which.
2. It creates or updates the database tables. It never deletes data.
3. It loads TIME's schools, programs, courses and intakes.
4. It says there is no administrator yet (see step 4).
5. It builds the app.

Preview deployments (Vercel makes one for every pull request) only build. They never touch the database.

## 4. Make the first administrator

1. Open the address Vercel gives you (it ends in `.vercel.app`) and add `/api/health`. It should show `{"ok":true}`.
2. On the platform, choose **Create account** and sign up with your own name, email and password. You start as a student.
3. In Vercel, add the variable `ADMIN_EMAIL` (Production) set to that email, then redeploy.
4. Sign out and in again: the menu shows **Administration**. Delete `ADMIN_EMAIL` from Vercel.
5. Make a second administrator: a colleague creates an account, and you change their role under **Administration**, **Accounts**.

Your password never passes through anyone else. (`ADMIN_NAME` and `ADMIN_PASSWORD` also work, creating a new account at deployment, but then the password sits in Vercel's settings until removed.)

## 5. Your own web address

1. In Vercel, open **Settings**, **Domains**, and add the address (for example `learn.` followed by TIME's domain).
2. Vercel shows one DNS record. Add it where the domain is managed, and wait until Vercel shows the address as valid.
3. Deploy once more (**Deployments**, the latest one, **Redeploy**) so the platform uses the new address.

You do not need to set `BETTER_AUTH_URL` on Vercel: the platform uses the live address Vercel reports. Set it only if sign-in misbehaves after a change of address.

## Afterwards

- **Updates:** merging into `main` deploys by itself, and applies any new database changes first.
- **Backups:** in Neon, confirm how far back the project can be restored, and move to a paid plan before real students enrol. Practise one restore into a separate branch.
- **Monitoring:** point an uptime monitor at `/api/health`.
- **Plan:** Vercel's free plan is for non-commercial use. Move to a paid plan before students pay fees through the platform.
- Then continue with [GOING-LIVE.md](GOING-LIVE.md), section 4.

## If the deployment fails

| The log says | Do this |
|---|---|
| `BETTER_AUTH_SECRET is too short` or `still an example value` | Replace it with a new random password of 40 or more characters. |
| `DATABASE_URL is not set` | The Neon database is not connected yet (step 2), or was connected with a custom prefix. |
| The site shows the public website, not the sign-in page | The project imported the wrong branch or folder: check Settings for Root Directory `platform` and the GitHub default branch `main`. |
| `ENOENT ... data/catalogue.json` | Switch on "Include files outside the root directory in the Build Step" (Settings, General, Root Directory). |
| `For a new account set ADMIN_NAME and an ADMIN_PASSWORD` | `ADMIN_EMAIL` does not match any account. Sign up on the platform with that email first (step 4). |
| An error during "Updating the database tables" | Check that `DATABASE_URL_UNPOOLED` exists under Environment Variables, then redeploy. |
