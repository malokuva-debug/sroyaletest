# 🎨 Visual Editor — Setup Guide

Your site now has a live, click-to-edit visual builder at **`/editor`**, matching
the approach used on your other site. This doc covers what changed and what
you need to do to turn it on.

## What was added

- **`/editor`** — a live visual builder. The canvas IS your real landing
  page (the same `LandingPageView` component that renders on the live site),
  so what you see is exactly what visitors see. Click any heading or
  paragraph and type directly into it. Hover an image (hero background,
  gallery photos) and click **Change image** to swap its URL. Hover list
  items (how-it-works steps, why-us cards, gallery photos, booking bullets,
  FAQ questions) for a small **×** to remove them, or use the dashed **+**
  tile to add a new one.
- **Bilingual editing, built in.** Nearly every field on this site has an
  Albanian and English version. The top bar has an **SQ / EN** toggle that
  controls which language you're editing (and previewing — the canvas
  actually re-renders in that language, so you see it exactly as that
  language's visitors would). Turn on **Show both languages** and a smaller,
  editable line for the *other* language appears directly beneath each
  field, so you can fill in both without switching back and forth.
- **Draft vs. Published** — edits save as a draft first. The live site only
  changes when you click **Publish**. **Responsive preview** opens the real,
  fully responsive page in a new tab, reading your unpublished draft.
- **One-click Rollback** — publishing keeps a copy of the previous live
  version, undoable instantly from the top bar.
- **Passcode-protected** — `/editor` and its API routes are locked behind an
  `EDITOR_PASSCODE`, completely separate from your dashboard's own login.

## What was NOT touched

- `BookingForm.tsx` and everything it does — booking creation, availability,
  services, the client/appointment flow — is untouched. It still sources its
  own `booking_*` text directly from `src/lib/translations.ts`.
- `/api/appointments`, `/api/availability`, `/api/salon`, `/api/push/*`,
  `/api/cron/*`, `/api/webhook/*`, `/api/notifications` — all untouched.
- `/dashboard` and `/dashboard/register` — your staff dashboard, its auth,
  and push notifications are completely unaffected.
- **Services grid, Team grid, and the address/hours in the Contact
  section** stay wired live to `/api/salon` (your Supabase-backed salon
  config). They are intentionally **not editable** from the visual editor —
  only their section headings (badge/title/subtitle) are — so pricing,
  staff, and opening hours can only ever be changed from the dashboard where
  they already live, never accidentally from the content editor.

## Content model

Because this site's content was mostly assembled from `translations.ts`
plus quite a few strings written directly inline in `page.tsx`, editable
content now lives in its own model: `src/lib/blocks/types.ts` (shape) and
`src/lib/blocks/defaults.ts` (the current live copy, pre-filled from your
existing translations so the first load is identical to today's site).
`translations.ts` itself is untouched and still powers the booking form and
the handful of DB-adjacent labels (address/hours labels, "Book"/"From"
micro-copy on service cards) that intentionally stay out of the editor.

## Setup (3 steps)

### 1. Run the database migration

In your Supabase project → **SQL Editor**, run the contents of
`supabase/001_site_content.sql`. It creates one new table, `site_content`,
reusing your existing service-role Supabase client
(`src/lib/supabase.js`) — no new credentials needed. It does not touch
`appointments`, `clients`, `services`, `staff`, or salon config in any way.

If you skip this step, the site keeps working exactly as it does today —
the homepage silently falls back to the built-in default content, and
`/editor` will just show a "not configured" message until the table exists.

### 2. Set an editor passcode

Add this to your `.env` (and to your host's environment variables):

```env
EDITOR_PASSCODE=choose-a-strong-passcode-here
```

This is separate from your dashboard login — anyone with this passcode can
edit and publish site content, so treat it like a password.

### 3. Deploy / restart

```bash
npm install
npm run build
npm start
```

Then visit `/editor`, enter your passcode, and start editing. Your first
**Publish** will populate `site_content` with your current copy (the editor
loads your existing translated text as the starting draft, so the first
save/publish won't change anything visually).

## Day-to-day use

1. Go to `/editor`, log in with your passcode.
2. Pick **SQ** or **EN** in the top bar for the language you want to edit;
   flip **Show both languages** on if you want to fill in both at once.
3. Click any heading/paragraph/button label on the canvas and type. Hover
   images to swap them, hover list items for add/remove controls.
4. Click **Save draft** to keep your work without going live, or **Publish**
   to push it to the live site immediately.
5. If something looks wrong after publishing, click the rollback icon (↺) in
   the top bar to instantly restore the previous published version.

## Honest scope notes

A few deliberate differences from a from-scratch page builder, given how
tightly this page's header (scroll-morph animation via refs) and sections
are wired together:

- **Section order is fixed** — you can edit, add, or remove items *within*
  a section (steps, cards, photos, bullets, FAQs), but you can't drag whole
  sections (Hero, Gallery, FAQ, etc.) into a new order. Reordering them
  safely would mean decoupling the header's scroll animation and in-page
  anchor links from a fixed layout, which risks breaking the polished scroll
  effect for a feature that's rarely needed on a page this custom.
- **No global color theme editor** — this site's palette is a full 10-step
  brand scale and 9-step gold scale tuned for contrast in specific
  combinations; exposing a few swatches without the rest risks readability
  issues (e.g. changing one background shade but not matching text shades).
  If you want a rebrand, that's a design pass worth doing directly in
  `globals.css` rather than through free-form pickers.
- Section icons (the ones next to each "why us" card or "how it works"
  step) aren't editable — only their text — since swapping icons needs an
  icon picker, which felt like more chrome than value for now.
