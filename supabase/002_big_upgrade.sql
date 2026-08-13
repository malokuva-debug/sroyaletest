-- Sparta Royale — v2 upgrade
--
-- Run this once in the Supabase SQL editor (Project → SQL Editor) AFTER
-- 001_site_content.sql and the base schema (docs/schema.sql).
--
-- Adds: service categories + sorting, worker↔service assignments,
-- additional-services catalog, worker salary settings, payroll,
-- recurring expenses, manual-revenue support on te_ardhurat,
-- idempotent appointment income, reminder dedup columns, and RLS on all
-- new tables (same convention as 001: RLS on, zero policies → only the
-- service-role key used by src/lib/supabase.js can touch them).
--
-- Every statement is additive / idempotent (IF NOT EXISTS) — safe to run
-- on an existing database without losing any data.

-- ─────────────────────────── services ───────────────────────────

create table if not exists service_categories (
  id text primary key not null,
  name text not null,
  position integer default 0
);

alter table services add column if not exists category_id text;
alter table services add column if not exists position integer default 0;

create index if not exists idx_services_category_id on services (category_id);
create index if not exists idx_services_position on services (position);
create index if not exists idx_service_categories_position on service_categories (position);

-- ─────────────────── worker ↔ service assignments ───────────────────

create table if not exists worker_services (
  worker_id text not null,
  service_id text not null,
  primary key (worker_id, service_id)
);

-- ─────────────────── additional services catalog ───────────────────

create table if not exists additional_services (
  id text primary key not null,
  name text not null,
  price real not null default 0,
  active boolean not null default true,
  position integer default 0
);

-- ─────────────────── worker settings (salary %) ───────────────────

create table if not exists worker_settings (
  worker_id text primary key not null,
  salary_percent real,
  notes text
);

-- ─────────────────── recurring expenses ───────────────────

create table if not exists recurring_expenses (
  id text primary key not null,
  name text not null,
  description text,
  amount real not null,
  category text,
  frequency text not null default 'monthly',   -- monthly | weekly | yearly
  day_of_month integer,                         -- monthly / yearly day (1-31)
  month integer,                                -- yearly month (1-12)
  weekday integer,                              -- weekly weekday (0-6, Sunday=0)
  next_due_date text,                           -- ISO date; when null it is computed
  active boolean not null default true,
  last_generated_at text
);

-- ─────────────────── payroll ───────────────────

create table if not exists payroll (
  id text primary key not null,
  period text not null,                         -- 'YYYY-MM'
  worker_id text not null,
  worker_name text,
  service_revenue real default 0,
  extra_revenue real default 0,
  total_revenue real default 0,
  salary_percent real,
  salary_amount real default 0,
  status text default 'draft',                  -- draft | paid
  paid_at text,
  notes text
);

create unique index if not exists payroll_period_worker_unique on payroll (period, worker_id);
create index if not exists idx_payroll_worker_id on payroll (worker_id);
create index if not exists idx_payroll_period on payroll (period);

-- ─────────────────── shpenzimet ───────────────────
-- `type` lets us tag salary / recurring / supply entries for filtering.

alter table shpenzimet add column if not exists type text;
create index if not exists idx_shpenzimet_type on shpenzimet (type);

-- ─────────────────── te_ardhurat ───────────────────
-- client_id is referenced by the app but was missing from the original
-- schema; also add extras + notes + source for manual revenue records.

alter table te_ardhurat add column if not exists client_id text;
alter table te_ardhurat add column if not exists extras text;
alter table te_ardhurat add column if not exists notes text;
alter table te_ardhurat add column if not exists source text;

create index if not exists idx_te_ardhurat_client_id on te_ardhurat (client_id);
create index if not exists idx_te_ardhurat_worker_id on te_ardhurat (worker_id);
create index if not exists idx_te_ardhurat_date on te_ardhurat (date);

-- Idempotent income: dedupe any pre-existing duplicates (keep one row per
-- from_appointment_id), then enforce it with a partial unique index so the
-- app can use upsert (on_conflict) instead of blind inserts.
delete from te_ardhurat a
where a.from_appointment_id is not null
  and exists (
    select 1 from te_ardhurat b
    where b.from_appointment_id = a.from_appointment_id
      and b.id <> a.id
      and b.id < a.id
  );

create unique index if not exists te_ardhurat_from_appointment_unique
  on te_ardhurat (from_appointment_id)
  where from_appointment_id is not null;

-- ─────────────────── appointments ───────────────────
-- reminder_sent_at = durable reminder dedup for the cron route.
-- reminder_minutes snapshots the configured lead time at fire time.

alter table appointments add column if not exists reminder_sent_at text;
alter table appointments add column if not exists reminder_minutes integer;

create index if not exists idx_appointments_reminder_sent
  on appointments (reminder_sent_at)
  where status = 'pending';

-- ─────────────────── settings seeds ───────────────────

insert into settings (key, value) values ('default_service_category', 'null')
  on conflict (key) do nothing;

-- ─────────────────── RLS ───────────────────

alter table service_categories enable row level security;
alter table worker_services enable row level security;
alter table additional_services enable row level security;
alter table worker_settings enable row level security;
alter table recurring_expenses enable row level security;
alter table payroll enable row level security;
