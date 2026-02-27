# Deploying to Vercel (including forked repos)

This guide covers what you need for the app to work on Vercel, especially **account creation (sign-up)**. If sign-up fails after deploying a fork, work through this checklist.

## Vercel plan: Hobby vs Pro (cron jobs)

This project uses **Vercel Cron Jobs** in `vercel.json`:

- `/api/scheduler/dispatch` — runs **every minute** (`*/1 * * * *`) to process the scheduled-posts queue.
- `/api/cron/digest` — daily and weekly notification digests (once per day).

**On the free Hobby plan**, cron jobs can only run **once per day**. Minute-level schedules (e.g. every minute or every hour) are not supported and can cause deployment to fail or crons to be rejected.

**If deployments fail** with errors related to crons or `vercel.json`, either:

1. **Upgrade to Pro** — minute-level cron is supported; the project will deploy as-is and the scheduler will run every minute, or  
2. **Stay on Hobby** — change the scheduler cron in `vercel.json` to at most once per day (e.g. `0 9 * * *`). Scheduled posts would then be processed only once daily instead of every minute.

## 1. Required environment variables in Vercel

In your Vercel project: **Settings → Environment Variables**. Add these and assign them to **Production** (and Preview if you use preview deployments).

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Your Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | **Critical for sign-up.** Server-only; used by `/api/auth/register` to create users. If this is missing, registration will fail. |
| `NEXT_PUBLIC_APP_URL` | No | Not needed for sign-up. Only used by standalone scripts (scheduler worker, recovery, import) when they call your app’s API by URL. Optional unless you run those scripts against the deployed app. |

- **Redeploy** after adding or changing environment variables (Vercel does not auto-redeploy).
- Do **not** commit `.env` or `.env.local`; use Vercel’s UI or CLI for production secrets.

**Why isn’t my Vercel app URL in the env vars?**  
Sign-up and login use relative URLs (`/api/auth/register`, etc.), so the app never needs to know its own URL for auth. The URL you **do** need to set is in **Supabase** (Authentication → URL Configuration → Site URL), so Supabase knows where to redirect users. `NEXT_PUBLIC_APP_URL` in Vercel is only for scripts that call your app by full URL (e.g. a separate scheduler or import script).

## 2. Supabase project and URL configuration

- The app must use a **Supabase project you control** (or have the keys for). If you forked the repo, you typically need **your own** Supabase project; the original repo’s project may be inaccessible or not configured for your URL.
- In **Supabase Dashboard** → **Authentication** → **URL Configuration**:
  - **Site URL**: set to your Vercel URL (e.g. `https://your-app.vercel.app`).
  - **Redirect URLs**: add the same URL (and any extra redirect paths you use, e.g. `/api/auth/callback` if applicable).

If the Site URL doesn’t match your Vercel deployment, auth and cookies may not work correctly.

## 3. Database (your own Supabase project)

If you created a **new** Supabase project for your fork:

1. Apply all migrations so the auth-related tables and triggers exist:
   - `user_profiles`, `user_roles`, `user_sessions`, `account_settings`, `audit_logs`, etc.
   - Triggers that assign a default role when a profile is created (referenced in the register route).
2. From the project root (with Supabase CLI linked to your project):
   ```bash
   npx supabase db push
   ```
   Or run the SQL migrations in the Supabase SQL Editor in order (oldest to newest).

Without these tables, sign-up can fail at “create profile” or “create session” with 500 errors.

## 4. Supabase project status (free tier)

Free-tier Supabase projects **pause after inactivity**. A paused project returns errors when the app calls Supabase (e.g. on register).

- In **Supabase Dashboard**, check that the project is **Active** (not paused).
- If it was paused, resume it and try sign-up again.

## 5. Finding the actual error

To see why account creation fails:

1. **Vercel**: **Project → Deployments → select latest deployment → Functions**. Open the log stream and try sign-up again; check logs for the `/api/auth/register` request.
2. **Browser**: Open **Developer Tools → Network**, attempt sign-up, and inspect the **POST** to `/api/auth/register`. Note the **status code** and **response body** (the API returns error details there).

Common responses:

- **503** with “Unable to connect to Supabase” → wrong URL, missing env vars, or project paused.
- **500** “Failed to create user” → often `SUPABASE_SERVICE_ROLE_KEY` missing or wrong.
- **500** “Failed to create profile” / “Failed to create session” → database tables or migrations missing.

## 6. Build fails: "do not have the required package(s) installed" (@types/react)

If the build fails with a message like *"It looks like you're trying to use TypeScript but do not have the required package(s) installed"* and suggests installing `@types/react`, the cause is usually that **devDependencies** are not installed in the Vercel build (e.g. when `NODE_ENV=production` is set during install). This project keeps `@types/react` and `@types/react-dom` in **dependencies** (not devDependencies) so they are always installed and the build succeeds. Do not move them back to devDependencies if you rely on Vercel builds.

## 7. Quick checklist

- [ ] `NEXT_PUBLIC_SUPABASE_URL` set in Vercel (your Supabase project URL).
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` set in Vercel.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in Vercel (required for registration).
- [ ] Supabase **Authentication → URL Configuration**: Site URL and Redirect URLs include your Vercel URL.
- [ ] If using a new Supabase project: all migrations applied (`user_profiles`, `user_roles`, `user_sessions`, etc.).
- [ ] Supabase project is **Active** (not paused).
- [ ] Redeployed on Vercel after changing env vars.

After fixing, try creating an account again and, if it still fails, use the logs and network response to pinpoint the step that errors.
