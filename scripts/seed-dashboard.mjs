import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  { auth: { persistSession: false } }
);

const SERVICES = [
  { name: "Manikyr Klasik", price: 8, duration: 45 },
  { name: "Manikyr Gel / Shellac", price: 15, duration: 60 },
  { name: "Nail Art", price: 20, duration: 90 },
  { name: "Pedikyr Spa", price: 15, duration: 60 },
  { name: "Akrilik & Zgjatime", price: 25, duration: 90 },
  { name: "Heqje & Trajtim", price: 5, duration: 30 },
];

const WORKERS = [
  { username: "elira", name: "Elira", role: "worker" },
  { username: "rina", name: "Rina", role: "worker" },
];

async function seedServices() {
  const { data: existing, error } = await supabase.from("services").select("name");
  if (error) throw error;
  const have = new Set((existing ?? []).map((r) => String(r.name).toLowerCase()));
  let added = 0;
  for (const s of SERVICES) {
    if (have.has(s.name.toLowerCase())) continue;
    const { error: insertErr } = await supabase
      .from("services")
      .insert({ id: randomUUID(), name: s.name, price: s.price, duration: s.duration });
    if (insertErr) throw insertErr;
    added++;
  }
  console.log(`services: +${added} (total ${(existing?.length ?? 0) + added})`);
}

async function seedWorkers() {
  const { data: existing, error } = await supabase.from("users").select("username");
  if (error) throw error;
  const have = new Set((existing ?? []).map((r) => String(r.username).toLowerCase()));
  const ids = [];
  for (const w of WORKERS) {
    if (have.has(w.username)) continue;
    const id = randomUUID();
    const { error: insertErr } = await supabase.from("users").insert({
      id,
      username: w.username,
      password_hash: "",
      role: w.role,
      name: w.name,
      status: "active",
    });
    if (insertErr) throw insertErr;
    ids.push(id);
  }
  console.log(`users: +${ids.length}`);
}

async function seedSettings() {
  const { data: all, error } = await supabase
    .from("users")
    .select("id, name, role, status")
    .eq("status", "active");
  if (error) throw error;

  // Mon–Sat 09:00–20:00, Sunday closed. Keys are JS getDay() values.
  const hours = {
    0: null,
    1: { open: "09:00", close: "20:00" },
    2: { open: "09:00", close: "20:00" },
    3: { open: "09:00", close: "20:00" },
    4: { open: "09:00", close: "20:00" },
    5: { open: "09:00", close: "21:00" },
    6: { open: "09:00", close: "18:00" },
  };

  const schedule = {};
  (all ?? []).forEach((u, i) => {
    schedule[String(u.id)] = {
      days: i % 2 === 0 ? [1, 2, 3, 4, 5, 6] : [2, 3, 4, 5, 6],
      start: "09:00",
      end: i % 2 === 0 ? "20:00" : "18:00",
      bookable: true,
    };
  });

  const booking = {
    slotInterval: 30,
    leadMinutes: 0,
    horizonDays: 30,
    instagram: "spartaroyale",
    address: "Rr. Kacaniku, Nr. 17",
    city: "Prishtinë, Kosovë",
  };

  const rows = [
    ["sparta_working_hours", JSON.stringify(hours)],
    ["sparta_worker_schedule", JSON.stringify(schedule)],
    ["sparta_booking", JSON.stringify(booking)],
  ];

  for (const [key, value] of rows) {
    const { error: upsertErr } = await supabase
      .from("settings")
      .upsert({ key, value }, { onConflict: "key" });
    if (upsertErr) throw upsertErr;
  }
  console.log(`settings: ${rows.map((r) => r[0]).join(", ")}`);
}

await seedServices();
await seedWorkers();
await seedSettings();
console.log("done");
