-- Run this once in Supabase → SQL Editor.
-- Creates a NEW table only. It does not touch appointments, clients,
-- services, staff, or salon config in any way — your booking system,
-- dashboard, push notifications and reminders are all unaffected.

create table if not exists site_content (
  id text primary key,
  draft jsonb,
  published jsonb,
  previous jsonb,
  updated_at timestamptz not null default now()
);

-- Row Level Security: only your server (using the service role key already
-- configured in src/lib/supabase.js) can read/write this table.
alter table site_content enable row level security;

-- No policies are created on purpose — with RLS on and zero policies,
-- the anon/public key gets zero access, and only the service role
-- (used server-side) can read or write.
