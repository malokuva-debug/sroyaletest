/**
 * Central availability engine — the single source of truth for "who is
 * bookable and when". Both the public booking API (/api/availability,
 * /api/appointments) and the dashboard read from this one pure function.
 *
 * Sources of truth (all settings-JSON, no duplicate state):
 *  - shop opening hours        → salon.config.hours (sparta_working_hours)
 *  - worker weekly schedule    → worker.days/start/end (sparta_worker_schedule)
 *  - worker unavailability     → salon.unavailability (sparta_worker_unavailability)
 *  - worker↔service capability → salon.workerServices (worker_services table)
 *  - worker↔add-on capability  → salon.workerAdditionalServices (worker_additional_services)
 *  - existing appointments     → busy blocks passed in by the caller
 */

import type { SalonData } from "./dashboard-db";

export interface BusyBlock {
  workerId: string | null;
  start: number;
  end: number;
}

export interface SlotInfo {
  time: string;
  available: boolean;
  workerIds: string[];
}

export interface AvailabilityResult {
  date: string;
  closed: boolean;
  open?: string;
  close?: string;
  slots: SlotInfo[];
  workers: { id: string; name: string; working: boolean }[];
}

export interface AvailabilityInput {
  date: string;
  serviceDuration: number;
  workerId?: string | null;
  serviceId?: string | null;
  extraIds?: string[];
  salon: SalonData;
  busy: BusyBlock[];
  now?: { todayIso: string; minutesNow: number };
}

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const toHHMM = (mins: number): string =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

export function getKosovoNow(): { todayIso: string; minutesNow: number } {
  const formatter = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const todayIso = `${get("year")}-${get("month")}-${get("day")}`;
  const minutesNow = Number(get("hour")) * 60 + Number(get("minute"));
  return { todayIso, minutesNow };
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * True when a worker is on an unavailability entry for the given date. Both
 * single-day entries ({ date }) and date-range entries ({ date, endDate })
 * are honoured; an entry without start/end times blocks the whole day.
 */
function workerBlockedOn(
  unavailability: SalonData["unavailability"],
  workerId: string,
  date: string,
  slotStart: number,
  slotEnd: number
): boolean {
  for (const u of unavailability) {
    if (u.workerId !== workerId) continue;
    if (u.date > date) continue;
    if (u.endDate && u.endDate < date) continue;
    if (!u.endDate && u.date !== date) continue;
    if (!u.startTime || !u.endTime) return true; // all-day block
    if (overlaps(slotStart, slotEnd, toMinutes(u.startTime), toMinutes(u.endTime))) return true;
  }
  return false;
}

export function computeAvailability(input: AvailabilityInput): AvailabilityResult {
  const { date, serviceDuration, workerId, serviceId, extraIds = [], salon, busy, now } = input;

  const dow = new Date(`${date}T00:00:00`).getDay();
  const dayHours = salon.config.hours[String(dow)];

  // Per-worker capability: worker_services covers the main service,
  // worker_additional_services covers the selected add-ons. When there are
  // no explicit rows for a table, workers are considered able to do anything
  // (existing behaviour), so old deployments keep working.
  const capable = (wId: string): boolean => {
    if (serviceId) {
      if (salon.workerServices && salon.workerServices.length > 0) {
        const hasService = salon.workerServices.some(
          (ws) => ws.workerId === wId && ws.serviceId === serviceId
        );
        if (!hasService) return false;
      }
    }
    if (extraIds.length > 0 && salon.workerAdditionalServices && salon.workerAdditionalServices.length > 0) {
      for (const extraId of extraIds) {
        const ok = salon.workerAdditionalServices.some(
          (was) => was.workerId === wId && was.additionalServiceId === extraId
        );
        if (!ok) return false;
      }
    }
    return true;
  };

  const workerList = salon.workers.map((w) => ({
    id: w.id,
    name: w.name,
    working: w.days.includes(dow) && capable(w.id),
  }));

  if (!dayHours) {
    return { date, closed: true, slots: [], workers: workerList };
  }

  const salonOpen = toMinutes(dayHours.open);
  const salonClose = toMinutes(dayHours.close);
  const step = salon.config.slotInterval || 30;
  const duration = serviceDuration > 0 ? serviceDuration : 60;

  const { todayIso, minutesNow } = now ?? getKosovoNow();
  const earliest = date === todayIso ? minutesNow + (salon.config.leadMinutes || 0) : -1;

  const pool = salon.workers.filter(
    (w) =>
      w.days.includes(dow) &&
      capable(w.id) &&
      (!workerId || w.id === workerId)
  );

  const slots: SlotInfo[] = [];
  for (let t = salonOpen; t + duration <= salonClose; t += step) {
    if (t < earliest) {
      slots.push({ time: toHHMM(t), available: false, workerIds: [] });
      continue;
    }

    const free = pool.filter((w) => {
      const ws = Math.max(salonOpen, toMinutes(w.start));
      const we = Math.min(salonClose, toMinutes(w.end));
      if (t < ws || t + duration > we) return false;
      if (workerBlockedOn(salon.unavailability, w.id, date, t, t + duration)) return false;
      return !busy.some(
        (b) => (b.workerId === w.id || b.workerId === null) && overlaps(t, t + duration, b.start, b.end)
      );
    });

    slots.push({
      time: toHHMM(t),
      available: free.length > 0,
      workerIds: free.map((w) => w.id),
    });
  }

  return {
    date,
    closed: false,
    open: dayHours.open,
    close: dayHours.close,
    slots,
    workers: workerList,
  };
}
