-- Sparta Royale — Supabase schema
--
-- Run this once in the Supabase SQL editor (Project → SQL Editor) for the
-- project referenced by SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.
--
-- The app talks to Supabase exclusively through the supabase-js SDK
-- (src/lib/supabase.js) — there is no runtime schema migration anymore, so
-- these tables must exist before the app is used.
--
-- Note: no FOREIGN KEY constraints, on purpose — the app manages referential
-- integrity at the application level (e.g. optimistic saves may insert a
-- child row like an appointment before its parent client row completes).

CREATE TABLE IF NOT EXISTS appointments (
  id text PRIMARY KEY NOT NULL,
  client_id text,
  client_name text,
  service_id text,
  service_name text,
  worker_id text,
  date text NOT NULL,
  time text NOT NULL,
  duration integer,
  status text DEFAULT 'pending',
  notes text,
  extra_services text,
  price real,
  client_phone text
);

CREATE TABLE IF NOT EXISTS clients (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  notes text,
  visits integer DEFAULT 0,
  total_spent real DEFAULT 0
);

CREATE TABLE IF NOT EXISTS produktet (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  quantity integer NOT NULL,
  min_quantity integer DEFAULT 5,
  price real,
  usage_per_appointment integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS services (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  price real NOT NULL,
  duration integer
);

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY NOT NULL,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS shpenzimet (
  id text PRIMARY KEY NOT NULL,
  description text NOT NULL,
  amount real NOT NULL,
  date text NOT NULL,
  category text
);

CREATE TABLE IF NOT EXISTS te_ardhurat (
  id text PRIMARY KEY NOT NULL,
  client_name text,
  service_name text,
  price real NOT NULL,
  date text NOT NULL,
  worker_id text,
  from_appointment_id text
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY NOT NULL,
  username text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL,
  name text,
  status text DEFAULT 'active'
);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username);

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY NOT NULL,
  user_id text,
  expires_at integer NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id text PRIMARY KEY NOT NULL,
  endpoint text NOT NULL UNIQUE,
  subscription text NOT NULL,
  created_at text NOT NULL,
  user_id text
);

CREATE INDEX IF NOT EXISTS idx_clients_name ON clients (name);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients (phone);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments (client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_worker_id ON appointments (worker_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments (date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments (status);
CREATE INDEX IF NOT EXISTS idx_appointments_service_id ON appointments (service_id);
CREATE INDEX IF NOT EXISTS idx_te_ardhurat_from_appointment_id ON te_ardhurat (from_appointment_id);
