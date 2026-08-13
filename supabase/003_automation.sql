-- Sparta Royale — v3 automation upgrade
--
-- Run this once in the Supabase SQL editor (Project → SQL Editor) AFTER
-- 002_big_upgrade.sql.
--
-- Adds fields for the fully-automatic recurring-expense and worker-payroll
-- flows:
--   * recurring_expenses.start_date / end_date (scheduling window)
--   * worker_settings payroll config (active, frequency, pay day, start date,
--     next pay date, last processed period end)
--   * payroll.period_start / period_end / appointment_count (pay window)
--   * shpenzimet.worker_id / source_id (associate generated transactions)
--
-- Every statement is additive / idempotent (IF NOT EXISTS) — safe to run on
-- an existing database without losing any data.

-- ─────────────────── recurring expenses ───────────────────

alter table recurring_expenses add column if not exists start_date text;
alter table recurring_expenses add column if not exists end_date text;

-- ─────────────────── worker payroll settings ───────────────────

alter table worker_settings add column if not exists payroll_active boolean not null default false;
alter table worker_settings add column if not exists payroll_frequency text;  -- weekly | monthly | yearly
alter table worker_settings add column if not exists payroll_day integer;      -- weekday (0=Sun) for weekly, day-of-month otherwise
alter table worker_settings add column if not exists payroll_month integer;    -- month (1-12) for yearly
alter table worker_settings add column if not exists payroll_start_date text;  -- first payroll window start (optional)
alter table worker_settings add column if not exists next_payroll_date text;   -- next due payment date
alter table worker_settings add column if not exists last_payroll_period_end text; -- last processed window end (dedup)

-- ─────────────────── payroll ───────────────────

alter table payroll add column if not exists period_start text;
alter table payroll add column if not exists period_end text;
alter table payroll add column if not exists appointment_count integer default 0;

-- Replace the old (period, worker_id) unique index: a worker can now be paid
-- multiple times per calendar month (e.g. weekly), so uniqueness moves to the
-- explicit pay window (worker_id, period_start, period_end). Legacy draft rows
-- (period_start/end NULL) stay unique by their existing PK id.
drop index if exists payroll_period_worker_unique;
create unique index if not exists payroll_worker_period_unique
  on payroll (worker_id, period_start, period_end)
  where period_start is not null and period_end is not null;

-- ─────────────────── expenses ───────────────────

alter table shpenzimet add column if not exists worker_id text;
alter table shpenzimet add column if not exists source_id text;

create index if not exists idx_shpenzimet_worker_id on shpenzimet (worker_id);
create index if not exists idx_shpenzimet_source_id on shpenzimet (source_id);
create index if not exists idx_shpenzimet_date on shpenzimet (date);
