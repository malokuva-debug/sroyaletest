import { createClient } from '@supabase/supabase-js';

/**
 * Single Supabase client shared by the landing page AND the /dashboard app.
 * Both already pointed at the same Supabase project — this replaces every
 * direct Postgres connection (pg / postgres-js / drizzle) with the
 * supabase-js SDK talking to Supabase's REST (PostgREST) API instead.
 *
 * Uses the service role key because both apps need full read/write access
 * (bookings, clients, staff, settings, etc.) from trusted server-side code
 * only (Server Actions / Route Handlers) — never expose this key to the
 * browser.
 */

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn(
    '[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set — database calls will fail.'
  );
}

const globalForSupabase = globalThis;

export const supabase =
  globalForSupabase.__spartaSupabaseClient ??
  createClient(supabaseUrl || '', supabaseServiceRoleKey || '', {
    auth: { persistSession: false, autoRefreshToken: false },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.__spartaSupabaseClient = supabase;
}

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseServiceRoleKey);
}

/* ─────────────── camelCase (app code) ⇄ snake_case (DB columns) ─────────────── */
// Supabase/PostgREST returns/expects the actual Postgres column names
// (snake_case). The app's JS code — and the existing dashboard frontend —
// was written around drizzle's camelCase JS-side field names, so we convert
// at the edges to avoid touching every call site.

const camelToSnake = (str) => str.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
const snakeToCamel = (str) => str.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

export function toSnake(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[camelToSnake(k)] = v;
  }
  return out;
}

export function toCamel(row) {
  if (row == null || typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) out[snakeToCamel(k)] = v;
  return out;
}

export function toCamelArray(rows) {
  return (rows || []).map(toCamel);
}
