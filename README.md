# hoodfrenzy — landing page

Waitlist landing page for the hoodfrenzy launchpad. Next.js 16 (App Router,
Turbopack) + Tailwind v4, with signups stored in Supabase.

## Local development

```bash
npm install
cp .env.local.example .env.local   # then fill in the two values
npm run dev
```

## Environment variables

Both are public by design and get inlined into the browser bundle. They are
safe there because the database is protected by Row Level Security — see
`supabase/waitlist.sql`.

| Variable | Where to find it | Required |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API → **Project URL** | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → publishable / anon key | yes |
| `NEXT_PUBLIC_SITE_URL` | Your production URL, e.g. `https://hoodfrenzy.com` | recommended |

Notes:

- `NEXT_PUBLIC_SUPABASE_URL` must be the **Project URL with no path**
  (`https://<ref>.supabase.co`). Pasting the REST endpoint
  (`.../rest/v1/`) makes every request 404, because supabase-js appends
  `/rest/v1` itself.
- Never use a `service_role` / `sb_secret_…` key here. Anything prefixed
  `NEXT_PUBLIC_` ships to every visitor, and the service key bypasses RLS.
- `NEXT_PUBLIC_SITE_URL` only affects absolute URLs in the OG/Twitter card
  metadata. Without it, preview deploys fall back to `VERCEL_URL` and local
  falls back to `localhost:3000`.

## Database

Run `supabase/waitlist.sql` once in the Supabase SQL editor. It creates the
`waitlist` table and sets the access model:

- `anon` may **INSERT only** — no select, update or delete.
- There is deliberately **no SELECT policy**, so the email/wallet list cannot
  be read with the public key.
- The public signup count comes from `waitlist_count()`, a security-definer
  function returning a single number.

## Deploying to Vercel

1. Push this directory to its own Git repository.
2. In Vercel: **New Project** → import the repo. Framework preset is detected
   as Next.js; leave Root Directory as `./`.
3. Add the environment variables above under **Settings → Environment
   Variables** (Production *and* Preview). They are not in the repo — Vercel
   cannot pick them up from `.env.local`.
4. Deploy.

After the first deploy, set `NEXT_PUBLIC_SITE_URL` to the real domain and
redeploy so social cards resolve against it.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build locally |
| `npm run lint` | ESLint |
