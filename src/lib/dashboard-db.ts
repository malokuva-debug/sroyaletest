import { randomUUID } from "node:crypto";
import { supabase, hasSupabaseConfig } from "./supabase";
import {
  computeAvailability,
  getKosovoNow,
  toHHMM,
  toMinutes,
  type BusyBlock,
  type SlotInfo,
  type AvailabilityResult,
} from "./availability";

export { getKosovoNow, toHHMM, toMinutes, type BusyBlock, type SlotInfo, type AvailabilityResult };

/**
 * Live connection to the Sparta Royale dashboard database, via the
 * supabase-js SDK (previously a raw `pg` Pool / Postgres connection string).
 * The public site reads services, workers, settings and availability from
 * here, then writes confirmed booking requests back into the dashboard's
 * `appointments` table.
 *
 * This talks to the SAME Supabase project as `src/lib/actions.js` (the
 * dashboard app) — there is no separate local database anymore.
 */

/* ─────────────────────────── types ─────────────────────────── */

export interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  categoryId: string | null;
  position: number;
}

export interface ServiceCategory {
  id: string;
  name: string;
  position: number;
}

export interface WorkerService {
  workerId: string;
  serviceId: string;
}

export interface AdditionalService {
  id: string;
  name: string;
  price: number;
  active: boolean;
  position: number;
  serviceId: string | null;
}

export interface WorkerAdditionalService {
  workerId: string;
  additionalServiceId: string;
}

export interface Worker {
  id: string;
  name: string;
  role: string;
  days: number[];
  start: string;
  end: string;
}

export interface DayHours {
  open: string;
  close: string;
}

export interface SalonConfig {
  hours: Record<string, DayHours | null>;
  slotInterval: number;
  leadMinutes: number;
  horizonDays: number;
  instagram: string;
  address: string;
  city: string;
}

export interface SalonData {
  services: Service[];
  categories: ServiceCategory[];
  workerServices: WorkerService[];
  workerAdditionalServices: WorkerAdditionalService[];
  additionalServices: AdditionalService[];
  workers: Worker[];
  config: SalonConfig;
  preferredServiceId: string | null;
  unavailability: UnavailabilityEntry[];
}

export interface UnavailabilityEntry {
  id: string;
  workerId: string;
  date: string;
  endDate?: string | null;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
}

/* ───────────────────────── defaults ───────────────────────── */

const DEFAULT_HOURS: Record<string, DayHours | null> = {
  "0": null,
  "1": { open: "09:00", close: "20:00" },
  "2": { open: "09:00", close: "20:00" },
  "3": { open: "09:00", close: "20:00" },
  "4": { open: "09:00", close: "20:00" },
  "5": { open: "09:00", close: "21:00" },
  "6": { open: "09:00", close: "18:00" },
};

const DEFAULT_CONFIG: SalonConfig = {
  hours: DEFAULT_HOURS,
  slotInterval: 30,
  leadMinutes: 0,
  horizonDays: 30,
  instagram: "spartaroyale",
  address: "Rr. Kacaniku, Nr. 17",
  city: "Prishtinë, Kosovë",
};

/* ─────────────────────────── helpers ─────────────────────────── */

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^+\d]/g, "").replace(/^00/, "+");
}

function digitsOnly(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

/* ───────────────────────── settings ───────────────────────── */

async function readSettings(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("settings").select("key, value");
  if (error || !data) return {};
  const out: Record<string, string> = {};
  data.forEach((r: { key: string; value: string | null }) => {
    out[String(r.key)] = r.value == null ? "" : String(r.value);
  });
  return out;
}

async function preferredServiceId(services: Service[]): Promise<string | null> {
  if (services.length === 0) return null;
  try {
    // No raw GROUP BY over PostgREST — pull the (small) set of service
    // references off appointments and tally the most common one in JS.
    const { data, error } = await supabase
      .from("appointments")
      .select("service_id, service_name")
      .not("service_id", "is", null)
      .limit(5000);
    if (error || !data || data.length === 0) return services[0].id;

    const counts = new Map<string, { serviceId: string | null; serviceName: string | null; total: number }>();
    for (const r of data as { service_id: string | null; service_name: string | null }[]) {
      const key = `${r.service_id ?? ""}|${r.service_name ?? ""}`;
      const entry = counts.get(key) ?? { serviceId: r.service_id, serviceName: r.service_name, total: 0 };
      entry.total += 1;
      counts.set(key, entry);
    }
    const top = [...counts.values()].sort((a, b) => b.total - a.total)[0];
    const byId = top?.serviceId ? services.find((s) => s.id === String(top.serviceId)) : null;
    if (byId) return byId.id;
    const byName = top?.serviceName
      ? services.find((s) => s.name.toLowerCase() === String(top.serviceName).toLowerCase())
      : null;
    return byName?.id ?? services[0].id;
  } catch {
    return services[0].id;
  }
}

/* ───────────────────── main data loader ───────────────────── */

let memo: { at: number; data: SalonData } | null = null;
const TTL = 30_000;

export async function getSalonData(force = false): Promise<SalonData> {
  if (!force && memo && Date.now() - memo.at < TTL) return memo.data;

  const empty: SalonData = {
    services: [],
    categories: [],
    workerServices: [],
    workerAdditionalServices: [],
    additionalServices: [],
    workers: [],
    config: DEFAULT_CONFIG,
    preferredServiceId: null,
    unavailability: [],
  };
  if (!hasSupabaseConfig()) return empty;

  try {
    const [svcRes, catRes, wsRes, waRes, addRes, userRes, settings] = await Promise.all([
      supabase.from("services").select("id, name, price, duration, category_id, position"),
      supabase.from("service_categories").select("*"),
      supabase.from("worker_services").select("*"),
      supabase.from("worker_additional_services").select("*"),
      supabase.from("additional_services").select("*"),
      supabase
        .from("users")
        .select("id, name, username, role, status")
        .or("status.eq.active,status.is.null"),
      readSettings(),
    ]);

    if (svcRes.error) throw svcRes.error;
    if (catRes.error) throw catRes.error;
    if (wsRes.error) throw wsRes.error;
    if (waRes.error) throw waRes.error;
    if (addRes.error) throw addRes.error;
    if (userRes.error) throw userRes.error;

    const svcRows = svcRes.data ?? [];
    const catRows = catRes.data ?? [];
    const wsRows = wsRes.data ?? [];
    const waRows = waRes.data ?? [];
    const addRows = addRes.data ?? [];
    const userRows = userRes.data ?? [];

    const hours = parseJson(settings["sparta_working_hours"], DEFAULT_HOURS);
    const bookingCfg = parseJson(settings["sparta_booking"], {} as Partial<SalonConfig>);
    const schedule = parseJson(
      settings["sparta_worker_schedule"],
      {} as Record<string, { days?: number[]; start?: string; end?: string; bookable?: boolean }>
    );
    const unavailability: UnavailabilityEntry[] = parseJson(
      settings["sparta_worker_unavailability"],
      [] as UnavailabilityEntry[]
    );

    const config: SalonConfig = {
      hours,
      slotInterval: Number(bookingCfg.slotInterval) || DEFAULT_CONFIG.slotInterval,
      leadMinutes: Number(bookingCfg.leadMinutes ?? DEFAULT_CONFIG.leadMinutes),
      horizonDays: Number(bookingCfg.horizonDays) || DEFAULT_CONFIG.horizonDays,
      instagram: bookingCfg.instagram || DEFAULT_CONFIG.instagram,
      address: bookingCfg.address || DEFAULT_CONFIG.address,
      city: bookingCfg.city || DEFAULT_CONFIG.city,
    };

    const categories: ServiceCategory[] = catRows
      .map((r: { id: unknown; name: unknown; position: unknown }) => ({
        id: String(r.id),
        name: String(r.name ?? "").trim(),
        position: Number(r.position ?? 0) || 0,
      }))
      .filter((c: ServiceCategory) => c.id && c.name);

    const catOrder = new Map<string, number>();
    categories.forEach((c, i) => catOrder.set(c.id, i));

    const services: Service[] = svcRows
      .map((r: { id: unknown; name: unknown; price: unknown; duration: unknown; category_id: unknown; position: unknown }) => ({
        id: String(r.id),
        name: String(r.name ?? "").trim(),
        price: Number(r.price ?? 0),
        duration: Number(r.duration ?? 60) || 60,
        categoryId: r.category_id == null ? null : String(r.category_id),
        position: Number(r.position ?? 0) || 0,
      }))
      .filter((s: { name?: string; price: number; duration: number }) => s.name)
      .sort(
        (a: Service, b: Service) =>
          (catOrder.get(a.categoryId ?? "") ?? 999) - (catOrder.get(b.categoryId ?? "") ?? 999) ||
          a.position - b.position ||
          a.name.localeCompare(b.name)
      );

    const workerServices: WorkerService[] = wsRows.map(
      (r: { worker_id: unknown; service_id: unknown }) => ({
        workerId: String(r.worker_id),
        serviceId: String(r.service_id),
      })
    );

    const workerAdditionalServices: WorkerAdditionalService[] = waRows.map(
      (r: { worker_id: unknown; additional_service_id: unknown }) => ({
        workerId: String(r.worker_id),
        additionalServiceId: String(r.additional_service_id),
      })
    );

    const additionalServices: AdditionalService[] = addRows
      .map((r: { id: unknown; name: unknown; price: unknown; active: unknown; position: unknown; service_id: unknown }) => ({
        id: String(r.id),
        name: String(r.name ?? "").trim(),
        price: Number(r.price ?? 0),
        active: r.active !== false,
        position: Number(r.position ?? 0) || 0,
        serviceId: r.service_id == null ? null : String(r.service_id),
      }))
      .filter((s: AdditionalService) => s.id && s.name)
      .sort((a: AdditionalService, b: AdditionalService) => a.position - b.position || a.name.localeCompare(b.name));

    const workers: Worker[] = userRows
      .map((r: { id: unknown; name: unknown; username: unknown; role: unknown }) => {
        const id = String(r.id);
        const sch = schedule[id] ?? {};
        if (sch.bookable === false) return null;
        return {
          id,
          name: String(r.name || r.username || "").trim() || "Staf",
          role: String(r.role ?? "worker"),
          days: Array.isArray(sch.days) ? sch.days.map(Number) : [1, 2, 3, 4, 5, 6],
          start: sch.start || "09:00",
          end: sch.end || "20:00",
        };
      })
      .filter((w: Worker | null): w is Worker => w !== null)
      .sort((a: Worker, b: Worker) => a.name.localeCompare(b.name));

    const data: SalonData = {
      services,
      categories,
      workerServices,
      workerAdditionalServices,
      additionalServices,
      workers,
      config,
      preferredServiceId: await preferredServiceId(services),
      unavailability,
    };
    memo = { at: Date.now(), data };
    return data;
  } catch (err) {
    console.error("[dashboard-db] getSalonData failed:", err);
    return empty;
  }
}

/* ──────────────────────── availability ──────────────────────── */

async function getBusyBlocks(date: string): Promise<BusyBlock[]> {
  try {
    const { data, error } = await supabase
      .from("appointments")
      .select("worker_id, time, duration")
      .eq("date", date)
      .or("status.is.null,status.neq.canceled");
    if (error || !data) return [];
    return data.map((r: { worker_id: unknown; time: unknown; duration: unknown }) => {
      const start = toMinutes(String(r.time ?? "00:00"));
      const dur = Number(r.duration ?? 60) || 60;
      return {
        workerId: r.worker_id == null ? null : String(r.worker_id),
        start,
        end: start + dur,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Real availability: salon opening hours ∩ worker schedule − existing
 * appointments (duration-aware) − same-day lead time − worker unavailability
 * − worker↔service capability. Delegates to the shared engine in
 * `availability.ts` so the booking API, dashboard and cron all agree.
 */
export async function getAvailability(
  date: string,
  serviceDuration: number,
  workerId?: string | null,
  serviceId?: string | null,
  extraIds?: string[]
): Promise<AvailabilityResult> {
  const salon = await getSalonData();
  const busy = hasSupabaseConfig() ? await getBusyBlocks(date) : [];

  return computeAvailability({
    date,
    serviceDuration,
    workerId,
    serviceId,
    extraIds,
    salon,
    busy,
  });
}

/* ────────────────────────── booking ────────────────────────── */

export interface CreateBooking {
  clientName: string;
  phone: string;
  serviceId: string;
  date: string;
  time: string;
  workerId?: string | null;
  notes?: string | null;
  extras?: { id: string; name: string; price: number }[];
}

export interface BookingResult {
  ok: boolean;
  id?: string;
  workerName?: string;
  service?: Service;
  clientId?: string | null;
  error?: "no_db" | "bad_service" | "closed" | "taken" | "failed";
}

async function findOrCreateClient(name: string, phone: string): Promise<string | null> {
  const cleanPhone = normalizePhone(phone);
  const cleanDigits = digitsOnly(cleanPhone);
  try {
    // PostgREST can't run the REPLACE()-chain phone comparison in-database,
    // so pull candidate rows and normalize/compare in JS instead.
    const { data: candidates, error } = await supabase
      .from("clients")
      .select("id, phone")
      .not("phone", "is", null);
    if (error) throw error;

    const match = (candidates ?? []).find(
      (c: { id: unknown; phone: unknown }) =>
        digitsOnly(String(c.phone ?? "")) === cleanDigits && cleanDigits.length > 0
    );

    if (match?.id != null) {
      const id = String(match.id);
      const update: Record<string, unknown> = { phone: cleanPhone };
      if (name) update.name = name; // COALESCE(NULLIF(name,''), name) equivalent
      await supabase.from("clients").update(update).eq("id", id);
      return id;
    }

    const id = randomUUID();
    const { error: insertErr } = await supabase.from("clients").insert({
      id,
      name,
      phone: cleanPhone,
      email: null,
      notes: "Rezervim online",
      visits: 0,
      total_spent: 0,
    });
    if (insertErr) throw insertErr;
    return id;
  } catch (err) {
    console.error("[dashboard-db] findOrCreateClient failed:", err);
    return null;
  }
}

export async function createBooking(input: CreateBooking): Promise<BookingResult> {
  if (!hasSupabaseConfig()) return { ok: false, error: "no_db" };

  const { services, workers, additionalServices } = await getSalonData(true);
  const service = services.find((s) => s.id === input.serviceId);
  if (!service) return { ok: false, error: "bad_service" };

  // Resolve extra services against the salon catalog so clients can only
  // pick from active add-ons that belong to this service.
  const extras: AdditionalService[] = [];
  const extrasInput = Array.isArray(input.extras) ? input.extras : [];
  if (extrasInput.length > 0) {
    const byId = new Map(
      additionalServices
        .filter((x) => x.active !== false && x.serviceId === service.id)
        .map((x) => [x.id, x])
    );
    extrasInput.forEach((e) => {
      const found = byId.get(e.id);
      if (found) extras.push(found);
    });
  }
  const extraIds = extras.map((e) => e.id);
  const extrasTotal = extras.reduce((s, x) => s + Number(x.price || 0), 0);

  const availability = await getAvailability(
    input.date,
    service.duration,
    input.workerId,
    service.id,
    extraIds
  );
  if (availability.closed) return { ok: false, error: "closed" };

  const slot = availability.slots.find((s) => s.time === input.time);
  if (!slot || !slot.available || slot.workerIds.length === 0) {
    return { ok: false, error: "taken" };
  }

  const assignedId =
    input.workerId && slot.workerIds.includes(input.workerId)
      ? input.workerId
      : slot.workerIds[0];
  const assigned = workers.find((w) => w.id === assignedId);
  const cleanPhone = normalizePhone(input.phone);
  const clientId = await findOrCreateClient(input.clientName, cleanPhone);

  const noteParts = [`Tel: ${cleanPhone}`];
  if (input.notes) noteParts.push(input.notes);
  noteParts.push("Rezervim online");

  const id = randomUUID();
  try {
    const { error } = await supabase.from("appointments").insert({
      id,
      client_id: clientId,
      client_name: input.clientName,
      client_phone: cleanPhone,
      service_id: service.id,
      service_name: service.name,
      worker_id: assignedId,
      date: input.date,
      time: input.time,
      duration: service.duration,
      status: "pending",
      notes: noteParts.join(" · "),
      extra_services: extras.length > 0 ? JSON.stringify(extras) : null,
      price: service.price + extrasTotal,
    });
    if (error) throw error;
    return { ok: true, id, workerName: assigned?.name, service, clientId };
  } catch (err) {
    console.error("[dashboard-db] createBooking failed:", err);
    return { ok: false, error: "failed" };
  }
}
