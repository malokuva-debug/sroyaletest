# Sparta Royale — merged project

This project combines two previously separate apps into one Next.js 16 app:

- **spartalanding** → the public site, served at `/`. Booking form, services,
  availability, etc. (TypeScript, Tailwind v4)
- **sroyale** (the "dashboard") → the salon's internal management app, now
  served at `/dashboard`. Appointments, clients, staff, inventory, reports,
  push notifications, PWA install. (JS, shadcn/ui, Tailwind v4 after this
  migration — was v3)

Both already shared one Supabase Postgres project before this merge (the
landing page read services/hours/availability from it and wrote bookings
into it); that connection is now the dashboard's *only* database too.

## Routes

```
/                      landing page (spartalanding)
/dashboard             dashboard app — login screen + full admin UI
/dashboard/register    staff self-registration screen
/api/appointments      landing page booking submission
/api/availability      landing page availability lookup
/api/salon, /api/health
/api/cron/reminders    dashboard: appointment + low-stock push reminders (cron)
/api/notifications     dashboard: polled by its service worker
/api/push/subscribe    dashboard: web-push subscription management
/api/push/test         dashboard: push diagnostics
/api/webhook/new-appointment   dashboard: notified when a booking comes in
                               (now an in-process call — see below)
```

## Database

Both apps talk to **one** Supabase project through the `@supabase/supabase-js`
SDK — there is no local database and no direct Postgres connection anywhere
in the app anymore.

- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — configure the shared client
  in `src/lib/supabase.js`. Used by `src/lib/dashboard-db.ts` + `src/lib/push.ts`
  (landing page: read services/hours/availability, write bookings) **and** by
  `src/lib/actions.js` + `src/lib/dashboard-webpush.js` (dashboard: full
  read/write on appointments, clients, staff, inventory, settings, etc.).
- `src/lib/supabase.js` also exposes `toSnake`/`toCamel` helpers that convert
  between the app's camelCase JS objects and Postgres's snake_case columns,
  since PostgREST (what supabase-js talks to) works directly against real
  column names.
- There's no runtime schema migration — run `docs/schema.sql` once in the
  Supabase SQL editor to create the tables before first use.

## What changed during the merge (beyond moving files)

- All Postgres/drizzle access (`pg`, `postgres`, `drizzle-orm`) replaced with
  `@supabase/supabase-js`, and the landing page's own local Postgres mirror
  table (`src/db/`, `DATABASE_URL`) removed entirely — see "Database" above.
- All `cookies()` calls in `src/lib/actions.js` and the notifications route
  updated to `await cookies()` — required by Next 15+'s async dynamic APIs
  (the dashboard was built on Next 14).
- `src/lib/translations.js` → `src/lib/dashboard-translations.js` and
  `src/lib/webpush.js` → `src/lib/dashboard-webpush.js`, to avoid clashing
  with spartalanding's own same-named files. Imports updated accordingly.
- `revalidatePath('/')` → `revalidatePath('/dashboard')` throughout `actions.js`.
- Internal `<Link>`s (`/` → `/dashboard`, `/register` → `/dashboard/register`)
  fixed inside the dashboard's own pages.
- `public/manifest.json` and `public/sw.js`: `start_url`/`scope`/precache path
  changed from `/` to `/dashboard`, and the service worker now registers
  with `scope: '/dashboard/'` so it never touches the landing page.
- Added `src/app/dashboard/layout.tsx` — a nested layout carrying the
  dashboard's own metadata, PWA manifest link, `noindex` (it's an admin
  panel), and the service-worker registration script. Only the *root*
  layout may render `<html>/<body>`, so this is a plain fragment.
- Tailwind: the dashboard was on Tailwind v3 with a JS config
  (`tailwind.config.js`) and the `tailwindcss-animate` plugin. Converted
  everything into `@theme`/CSS-variable form in the single root
  `src/app/globals.css` (Tailwind v4 requires config-as-CSS, and only the
  root layout may import global CSS in the App Router). This includes the
  dashboard's rose/pink/amber → brand-burgundy color remapping, all the
  shadcn CSS variable tokens, and hand-written `@keyframes` for the
  accordion component (replacing the `tailwindcss-animate` plugin, the
  same approach spartalanding's own CSS already used for its `animate-in`
  utility).
- `tsconfig.json`: `allowJs: true` (the dashboard is JS/JSX).

## Verified

`npm install && npm run build` completes cleanly, and `/`, `/dashboard`,
`/dashboard/register`, and `/manifest.json` all serve 200s with correct,
distinct `<title>`/metadata per route.

## Still worth doing before shipping to production

- Point `WEBHOOK_SECRET`/`CRON_SECRET`/VAPID keys at real values (see
  `.env.example`).
- The landing page's `/api/appointments` route still has an *external*
  webhook fallback (`DASHBOARD_URL` + `/api/webhook/new-appointment`) left
  over from when the dashboard was a separate deployment. Harmless to leave
  as-is (it just won't fire without `DASHBOARD_URL` set), but you could call
  the logic in-process now instead of over HTTP if you want to simplify it.
- `docs/` carries over the dashboard's original user manual (EN/SQ) for
  reference — not required for the app to run.
