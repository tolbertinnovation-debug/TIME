# Putting TIME Learning online (Neon and Vercel)

Follow these steps once. After that, every change merged into `main` goes live by itself.

**Never put a password, key or connection string in an email, a chat or this repository.** They go only into Vercel's settings.

## Before you start

- PR #34 is merged, so the platform is on the `main` branch.
- You have a TIME-owned email address to register the accounts with (not a personal one), and a password manager to keep the passwords in.

## 1. Create the database (Neon)

1. Go to neon.tech and sign up.
2. Create a project named `time-learning`. Choose a region in Europe (the closest to Liberia). Keep PostgreSQL at the version offered.
3. On the project's dashboard, choose **Connect**. Copy the **connection string** (it starts with `postgresql://`). This is `DATABASE_URL`.
4. Optional but recommended: in the same box, switch **Connection pooling** off and copy that second string too. This is `DIRECT_URL`.

## 2. Create the project (Vercel)

1. Go to vercel.com and choose **Continue with GitHub**, using the account that owns the TIME repository.
2. Choose **Add New**, then **Project**, and import the `TIME` repository.
3. Set **Root Directory** to `platform`. Leave "Include files outside the root directory in the Build Step" switched **on** (the platform reads TIME's course catalogue from the website's folder).
4. Leave the build and install commands as they are. Vercel uses the platform's own `vercel-build` script.
5. Open **Environment Variables** and add these, for the **Production** environment:

| Name | Value |
|---|---|
| `DATABASE_URL` | The connection string from step 1.3 |
| `DIRECT_URL` | The second string from step 1.4 (optional) |
| `BETTER_AUTH_SECRET` | A new random password of 40 or more characters, from a password generator |
| `ADMIN_NAME` | The first administrator's full name |
| `ADMIN_EMAIL` | The first administrator's email address |
| `ADMIN_PASSWORD` | A password of at least 10 characters for that administrator |

6. Choose **Deploy**.

## 3. What the first deployment does

The build log shows lines starting with `[TIME Learning]`:

1. It checks the settings. If one is missing or unsafe, the deployment stops and says which.
2. It creates the database tables. It never deletes data.
3. It loads TIME's 4 schools, 6 programs, 41 courses and the 2027 intakes.
4. It creates the first administrator, only because there is none yet.
5. It builds the app.

Preview deployments (Vercel makes one for every pull request) only build. They never touch the database.

## 4. Check it

1. Open the address Vercel gives you (it ends in `.vercel.app`) and add `/api/health`. It should show `{"ok":true}`.
2. Sign in with the administrator's email and password.
3. In Vercel, open **Settings**, **Environment Variables**, and **delete `ADMIN_PASSWORD`**. It is not used again.
4. Create a second administrator: that person creates an account on the platform, and you change their role under **Administration**, **Accounts**.

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
| `DATABASE_URL is not set` | Add it under Environment Variables for Production, then redeploy. |
| `BETTER_AUTH_SECRET is too short` or `still an example value` | Replace it with a new random password of 40 or more characters. |
| `ENOENT ... data/catalogue.json` | Switch on "Include files outside the root directory in the Build Step" (Settings, General, Root Directory). |
| `For a new account set ADMIN_NAME and an ADMIN_PASSWORD` | Add the missing administrator settings; the password needs at least 10 characters. |
| An error during "Updating the database tables" | Add `DIRECT_URL` (step 1.4) and redeploy. |
