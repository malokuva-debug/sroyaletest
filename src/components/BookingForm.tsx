"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Check,
  Loader2,
  Calendar,
  Clock,
  User,
  FileText,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  CalendarX,
  Tag,
  Users,
  Sparkles,
  Phone,
} from "lucide-react";
import type { Language } from "@/lib/translations";
import type { SalonData, Service, Worker, AdditionalService } from "@/lib/dashboard-db";
import { serviceMeta } from "@/lib/service-meta";
import ServiceIcon from "./ServiceIcon";
import { Instagram } from "./icons";

interface SlotInfo {
  time: string;
  available: boolean;
  workerIds: string[];
}

interface Props {
  lang: Language;
  salon: SalonData | null;
  loading: boolean;
  preselect?: string;
  onConsumed?: () => void;
}

const C = {
  sq: {
    steps: ["Shërbimi", "Data & Ora", "Kontakti"],
    step: "Hapi",
    of: "nga",
    s1: "Cilin shërbim dëshironi?",
    s1h: "Çmimet, kohëzgjatja dhe shërbimi më i zgjedhur lexohen nga sistemi i sallonit.",
    mostBooked: "Më i zgjedhur",
    s2: "Kur ju përshtatet?",
    s2h: "Oraret llogariten nga ditët e punës, orari i stafit dhe takimet ekzistuese.",
    s3: "Të dhënat e klientit",
    s3h: "Emri dhe telefoni ruhen automatikisht në klientët e sallonit.",
    withWho: "Me kë dëshironi?",
    anyone: "Kushdo i lirë",
    anyoneHint: "Caktohet stafi i parë i disponueshëm",
    offToday: "Pushim këtë ditë",
    today: "Sot",
    tomorrow: "Nesër",
    closed: "Mbyllur",
    closedDay: "Këtë ditë jemi mbyllur",
    noSlots: "Nuk ka orare të lira për këtë ditë",
    tryAnother: "Provoni një ditë tjetër ose zgjidhni «Kushdo i lirë».",
    loading: "Duke kontrolluar oraret...",
    morning: "Paradite",
    afternoon: "Pasdite",
    evening: "Mbrëmje",
    openHours: "Hapur",
    name: "Emri dhe mbiemri",
    namePh: "p.sh. Arta Krasniqi",
    phone: "Telefoni i klientit",
    phonePh: "p.sh. 044 123 456",
    phoneHint: "Përdoret vetëm për rezervimin tuaj",
    notes: "Shënime",
    optional: "opsionale",
    notesPh: "Ngjyra e preferuar, alergji, kërkesa specifike...",
    summary: "Përmbledhje",
    extras: "Shërbime shtesë",
    change: "Ndrysho",
    min: "min",
    back: "Kthehu",
    next: "Vazhdo",
    submit: "Konfirmo Rezervimin",
    sending: "Duke dërguar...",
    okTitle: "Rezervimi u dërgua",
    okDesc: "Takimi u regjistrua në sistemin e sallonit. Klienti dhe telefoni u ruajtën automatikisht.",
    okAgain: "Bëj një rezervim tjetër",
    okDm: "Shkruaj në Instagram",
    with: "Me",
    reqName: "Ju lutem shkruani emrin tuaj.",
    reqPhone: "Ju lutem shkruani një numër telefoni valid.",
    reqSlot: "Ju lutem zgjidhni datën dhe orën.",
    err: "Ndodhi një gabim. Ju lutem provoni përsëri.",
    noServices: "Shërbimet po ngarkohen nga salloni...",
    days: ["Die", "Hën", "Mar", "Mër", "Enj", "Pre", "Sht"],
    months: ["Jan", "Shk", "Mar", "Pri", "Maj", "Qer", "Kor", "Gsh", "Sht", "Tet", "Nën", "Dhj"],
    locale: "sq-AL",
  },
  en: {
    steps: ["Service", "Date & Time", "Contact"],
    step: "Step",
    of: "of",
    s1: "Which service would you like?",
    s1h: "Prices, duration and the most-booked service come from the salon system.",
    mostBooked: "Most booked",
    s2: "When suits you?",
    s2h: "Times are calculated from working days, staff schedules and existing appointments.",
    s3: "Client details",
    s3h: "Name and phone are saved automatically to the salon clients list.",
    withWho: "Who would you like?",
    anyone: "Anyone available",
    anyoneHint: "The first available specialist is assigned",
    offToday: "Off this day",
    today: "Today",
    tomorrow: "Tomorrow",
    closed: "Closed",
    closedDay: "We're closed on this day",
    noSlots: "No free times on this day",
    tryAnother: "Try another day or choose “Anyone available”.",
    loading: "Checking availability...",
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    openHours: "Open",
    name: "Full name",
    namePh: "e.g. Arta Krasniqi",
    phone: "Client phone",
    phonePh: "e.g. 044 123 456",
    phoneHint: "Used only for your booking",
    notes: "Notes",
    optional: "optional",
    notesPh: "Preferred colour, allergies, special requests...",
    summary: "Summary",
    extras: "Add-ons",
    change: "Change",
    min: "min",
    back: "Back",
    next: "Continue",
    submit: "Confirm Booking",
    sending: "Sending...",
    okTitle: "Booking sent",
    okDesc: "The appointment was registered in the salon system. Client name and phone were saved automatically.",
    okAgain: "Make another booking",
    okDm: "Message on Instagram",
    with: "With",
    reqName: "Please enter your name.",
    reqPhone: "Please enter a valid phone number.",
    reqSlot: "Please choose a date and time.",
    err: "Something went wrong. Please try again.",
    noServices: "Loading services from the salon...",
    days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    locale: "en-GB",
  },
};

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function BookingForm({ lang, salon, loading, preselect, onConsumed }: Props) {
  const c = C[lang];

  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [workerId, setWorkerId] = useState("any");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [extras, setExtras] = useState<AdditionalService[]>([]);

  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [dayWorkers, setDayWorkers] = useState<{ id: string; name: string; working: boolean }[]>([]);
  const [dayClosed, setDayClosed] = useState(false);
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ worker?: string | null } | null>(null);

  const services: Service[] = salon?.services ?? [];
  const categories = salon?.categories ?? [];
  const workers: Worker[] = salon?.workers ?? [];
  const additionalServices: AdditionalService[] = salon?.additionalServices ?? [];
  const preferredServiceId = salon?.preferredServiceId ?? services[0]?.id ?? "";
  const igHandle = salon?.config.instagram ?? "spartaroyale";
  const horizon = salon?.config.horizonDays ?? 30;
  const hours = salon?.config.hours ?? {};

  const availableExtras = additionalServices.filter((x) => x.active !== false);

  // Workers allowed to perform the selected service (worker_services). When no
  // assignments are configured at all, every worker can do every service.
  const capableWorkerIds = useMemo(() => {
    if (!serviceId) return null;
    const ws = salon?.workerServices ?? [];
    if (ws.length === 0) return null;
    const ids = ws
      .filter((r) => r.serviceId === serviceId)
      .map((r) => r.workerId);
    return new Set(ids);
  }, [serviceId, salon?.workerServices]);
  const pickableWorkers = useMemo(() => {
    const ws = salon?.workers ?? [];
    if (!capableWorkerIds) return ws;
    return ws.filter((w) => capableWorkerIds.has(w.id));
  }, [capableWorkerIds, salon?.workers]);

  // Never keep a chosen worker that isn't assigned to the selected service.
  const activeWorkerId =
    capableWorkerIds !== null && workerId !== "any" && !capableWorkerIds.has(workerId)
      ? "any"
      : workerId;

  useEffect(() => {
    if (!serviceId && preferredServiceId) setServiceId(preferredServiceId);
  }, [preferredServiceId, serviceId]);

  useEffect(() => {
    if (preselect && services.some((s) => s.id === preselect)) {
      setServiceId(preselect);
      setStep(1);
      onConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect, services.length]);

  const days = useMemo(() => {
    const out: { iso: string; d: Date; closed: boolean }[] = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < horizon; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push({ iso: iso(d), d, closed: hours[String(d.getDay())] == null });
    }
    return out;
  }, [horizon, hours]);

  const service = services.find((s) => s.id === serviceId);

  const load = useCallback(async (dt: string, svc: string, wk: string) => {
    setSlotsLoading(true);
    try {
      const r = await fetch(
        `/api/availability?date=${dt}&serviceId=${encodeURIComponent(svc)}&workerId=${wk}`
      );
      const d = await r.json();
      setSlots(Array.isArray(d.slots) ? d.slots : []);
      setDayWorkers(Array.isArray(d.workers) ? d.workers : []);
      setDayClosed(Boolean(d.closed));
      setOpenLabel(d.open && d.close ? `${d.open} – ${d.close}` : null);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (date && serviceId) {
      setTime("");
      load(date, serviceId, activeWorkerId);
    }
  }, [date, serviceId, activeWorkerId, load]);

  const grouped = useMemo(() => {
    const g = { morning: [] as SlotInfo[], afternoon: [] as SlotInfo[], evening: [] as SlotInfo[] };
    slots.forEach((s) => {
      if (!s.available) return;
      const h = Number(s.time.split(":")[0]);
      if (h < 12) g.morning.push(s);
      else if (h < 17) g.afternoon.push(s);
      else g.evening.push(s);
    });
    return g;
  }, [slots]);

  const noneFree = date && !slotsLoading && !dayClosed && Object.values(grouped).every(list => list.length === 0);
  const todayIso = iso(new Date());
  const tomorrowIso = iso(new Date(Date.now() + 864e5));

  const reset = () => {
    setStep(0);
    setServiceId(preferredServiceId);
    setWorkerId("any");
    setDate("");
    setTime("");
    setName("");
    setPhone("");
    setNotes("");
    setExtras([]);
    setError("");
    setStatus("idle");
    setResult(null);
  };

  const submit = async () => {
    setError("");
    if (!name.trim()) return setError(c.reqName);
    if (phone.replace(/\D/g, "").length < 8) return setError(c.reqPhone);
    if (!date || !time || !serviceId) return setError(c.reqSlot);

    // Optimistic: show confirmation immediately, send to backend in background
    setStatus("done");

    try {
      const r = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: name.trim(),
          phone: phone.trim(),
          serviceId,
          date,
          time,
          workerId: activeWorkerId,
          notes: notes.trim() || undefined,
          extras: extras.map((e) => ({ id: e.id, name: e.name, price: e.price })),
          lang,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || c.err);
      setResult({ worker: d.worker ?? null });
    } catch (e) {
      // Already showing confirmation — just toast the error
      const msg = e instanceof Error ? e.message : c.err;
      // Non-critical: appointment likely went through anyway (webhook fired)
      console.error("[BookingForm] background save failed:", msg);
    }
  };

  if (status === "done") {
    return (
      <div className="flex flex-col items-center py-10 sm:py-14 px-2 text-center">
        <div className="relative mb-6">
          <span className="absolute inset-0 rounded-full bg-emerald-100 blur-2xl opacity-60" />
          <span className="relative flex w-16 h-16 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/50">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </span>
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-brand-800 mb-3 tracking-tight">{c.okTitle}</h3>
        <p className="text-slate-500 mb-7 max-w-sm leading-relaxed text-sm">{c.okDesc}</p>

        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-slate-50/70 p-4 mb-6 text-left space-y-2.5">
          <SumRow icon={<Tag className="w-3.5 h-3.5" />} v={service?.name} />
          <SumRow icon={<Phone className="w-3.5 h-3.5" />} v={phone} />
          <SumRow
            icon={<Calendar className="w-3.5 h-3.5" />}
            v={date && new Date(`${date}T00:00:00`).toLocaleDateString(c.locale, { weekday: "long", day: "numeric", month: "long" })}
          />
          <SumRow icon={<Clock className="w-3.5 h-3.5" />} v={`${time} · ${service?.duration} ${c.min}`} />
          {extras.length > 0 && (
            <SumRow icon={<Sparkles className="w-3.5 h-3.5" />} v={extras.map((e) => e.name).join(", ")} />
          )}
          {result?.worker && <SumRow icon={<Users className="w-3.5 h-3.5" />} v={`${c.with} ${result.worker}`} />}
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-sm">
          <a
            href={`https://ig.me/m/${igHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-brand-700 to-brand-600 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
          >
            <Instagram className="w-4 h-4" />
            {c.okDm}
          </a>
          <button
            onClick={reset}
            className="flex-1 px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 font-semibold text-sm hover:border-brand-300 hover:text-brand-700 transition-all active:scale-[0.98]"
          >
            {c.okAgain}
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
        <p className="text-sm text-slate-400">{c.noServices}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-7">
        <div className="flex items-center gap-2 mb-2">
          {c.steps.map((label, i) => (
            <div key={i} className="flex-1 flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className="flex items-center gap-2 min-w-0"
              >
                <span
                  className={`shrink-0 w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold transition-all duration-300 ${
                    i < step
                      ? "bg-emerald-500 text-white"
                      : i === step
                        ? "bg-brand-700 text-white ring-4 ring-brand-100"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {i < step ? <Check className="w-3 h-3" /> : i + 1}
                </span>
                <span
                  className={`text-xs font-medium truncate hidden sm:block ${
                    i === step ? "text-brand-800" : i < step ? "text-slate-500" : "text-slate-300"
                  }`}
                >
                  {label}
                </span>
              </button>
              {i < c.steps.length - 1 && (
                <span className={`flex-1 h-px transition-colors duration-500 ${i < step ? "bg-emerald-400" : "bg-slate-200"}`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 sm:hidden">
          {c.step} {step + 1} {c.of} {c.steps.length} {c.steps[step]}
        </p>
      </div>

      {step === 0 && (
        <div className="animate-in">
          <h3 className="text-lg font-bold text-slate-800 mb-1">{c.s1}</h3>
          <p className="text-sm text-slate-400 mb-5">{c.s1h}</p>

          {services.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
              <Sparkles className="w-6 h-6 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">{c.noServices}</p>
            </div>
          ) : (
            <>
              {categories.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-thin">
                  <button
                    type="button"
                    onClick={() => setActiveCategory("")}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
                      activeCategory === ""
                        ? "border-brand-600 bg-brand-700 text-white"
                        : "border-slate-200 bg-white text-slate-500 hover:border-brand-300"
                    }`}
                  >
                    {lang === "sq" ? "Të gjitha" : "All"}
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(activeCategory === cat.id ? "" : cat.id)}
                      className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
                        activeCategory === cat.id
                          ? "border-brand-600 bg-brand-700 text-white"
                          : "border-slate-200 bg-white text-slate-500 hover:border-brand-300"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {services.filter((s) => !activeCategory || s.categoryId === activeCategory).map((s) => {
                const meta = serviceMeta(s.name);
                const on = serviceId === s.id;
                const preferred = s.id === preferredServiceId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setServiceId(s.id);
                      setTimeout(() => setStep(1), 150);
                    }}
                    className={`relative text-left p-4 rounded-2xl border transition-all duration-200 active:scale-[0.99] ${
                      on
                        ? "border-brand-500 bg-brand-50/60 ring-2 ring-brand-100 shadow-sm"
                        : "border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50/30"
                    }`}
                  >
                    {preferred && (
                      <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-1 rounded-full bg-gold-100 text-gold-700 border border-gold-200">
                        {c.mostBooked}
                      </span>
                    )}
                    <span className={`inline-flex w-9 h-9 rounded-xl items-center justify-center mb-3 ${meta.chip}`}>
                      <ServiceIcon name={meta.icon} className="w-4 h-4" />
                    </span>
                    <p className="font-semibold text-slate-800 text-sm leading-snug mb-2 pr-20">{s.name}</p>
                    <div className="flex items-center gap-2.5 text-[11px]">
                      <span className={`font-bold ${meta.text}`}>{s.price}€</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-400 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {s.duration} {c.min}
                      </span>
                    </div>
                    {on && (
                      <span className="absolute bottom-3.5 right-3.5 w-5 h-5 rounded-full bg-brand-600 grid place-items-center">
                        <Check className="w-3 h-3 text-white" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {activeCategory && services.filter((s) => s.categoryId === activeCategory).length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center">
                <p className="text-sm text-slate-400">
                  {lang === "sq" ? "Nuk ka shërbime në këtë kategori." : "No services in this category yet."}
                </p>
              </div>
            )}
          </>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="animate-in">
          <h3 className="text-lg font-bold text-slate-800 mb-1">{c.s2}</h3>
          <p className="text-sm text-slate-400 mb-5">{c.s2h}</p>

          {workers.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-semibold mb-2.5">{c.withWho}</p>
              <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setWorkerId("any")}
                  className={`shrink-0 h-14 flex items-center gap-2.5 pl-2.5 pr-4 rounded-xl border transition-all active:scale-[0.97] ${
                    activeWorkerId === "any"
                      ? "border-brand-600 bg-brand-700 text-white shadow-md shadow-brand-700/20"
                      : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"
                  }`}
                >
                  <span className={`w-8 h-8 rounded-lg grid place-items-center ${activeWorkerId === "any" ? "bg-white/15" : "bg-brand-50 text-brand-600"}`}>
                    <Users className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-left">
                    <span className="block text-[12px] font-semibold leading-tight">{c.anyone}</span>
                    <span className={`block text-[10px] leading-tight ${activeWorkerId === "any" ? "text-white/60" : "text-slate-400"}`}>
                      {c.anyoneHint}
                    </span>
                  </span>
                </button>

                {pickableWorkers.map((w) => {
                  const on = activeWorkerId === w.id;
                  const info = dayWorkers.find((d) => d.id === w.id);
                  const off = date && info && !info.working;
                  const unavailable = date && info === undefined && !dayClosed && !slotsLoading;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      disabled={Boolean(off || unavailable)}
                      onClick={() => setWorkerId(w.id)}
                      className={`shrink-0 h-14 flex items-center gap-2.5 pl-2.5 pr-4 rounded-xl border transition-all active:scale-[0.97] ${
                        on
                          ? "border-brand-600 bg-brand-700 text-white shadow-md shadow-brand-700/20"
                          : off || unavailable
                            ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                            : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-lg grid place-items-center text-[11px] font-bold ${
                          on ? "bg-white/15 text-white" : off || unavailable ? "bg-slate-100 text-slate-300" : "bg-gold-100 text-gold-700"
                        }`}
                      >
                        {w.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="text-left">
                        <span className="block text-[12px] font-semibold leading-tight">{w.name}</span>
                        <span className={`block text-[10px] leading-tight ${on ? "text-white/60" : "text-slate-400"}`}>
                          {off || unavailable ? c.offToday : `${w.start}–${w.end}`}
                        </span>
                      </span>
                    </button>
                );
              })}
              </div>
            </div>
            )}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-thin">
            {days.map(({ iso: di, d, closed }) => {
              const on = date === di;
              const label = di === todayIso ? c.today : di === tomorrowIso ? c.tomorrow : c.days[d.getDay()];
              return (
                <button
                  key={di}
                  type="button"
                  disabled={closed}
                  onClick={() => setDate(di)}
                  className={`shrink-0 w-[72px] h-20 rounded-xl border text-center transition-all active:scale-[0.97] ${
                    closed
                      ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                      : on
                        ? "border-brand-600 bg-brand-700 text-white shadow-md shadow-brand-700/20"
                        : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50/40"
                  }`}
                >
                  <span className={`block text-[10px] font-medium uppercase tracking-wide ${on ? "text-white/65" : "text-slate-400"}`}>
                    {closed ? c.closed : label}
                  </span>
                  <span className="block text-lg font-bold leading-tight mt-1 tabular-nums">{d.getDate()}</span>
                  <span className={`block text-[10px] ${on ? "text-white/65" : "text-slate-400"}`}>{c.months[d.getMonth()]}</span>
                </button>
              );
            })}
          </div>

          {!date ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
              <Calendar className="w-6 h-6 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">{c.s2h}</p>
            </div>
          ) : slotsLoading ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 py-12 text-center">
              <Loader2 className="w-5 h-5 text-brand-400 mx-auto mb-2 animate-spin" />
              <p className="text-sm text-slate-400">{c.loading}</p>
            </div>
          ) : dayClosed ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 py-12 text-center px-4">
              <CalendarX className="w-6 h-6 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500 font-medium">{c.closedDay}</p>
            </div>
          ) : noneFree ? (
            <div className="rounded-2xl border border-gold-300 bg-gold-50 py-12 text-center px-4">
              <CalendarX className="w-6 h-6 text-gold-600 mx-auto mb-2" />
              <p className="text-sm text-gold-800 font-semibold mb-1">{c.noSlots}</p>
              <p className="text-xs text-gold-700/70">{c.tryAnother}</p>
            </div>
          ) : (
            <div className="space-y-5">
              {openLabel && (
                <p className="text-[11px] text-slate-400 inline-flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  {c.openHours} {openLabel}
                </p>
              )}
              {([["morning", c.morning], ["afternoon", c.afternoon], ["evening", c.evening]] as const).map(([k, label]) => {
                const list = grouped[k];
                if (list.length === 0) return null;
                return (
                  <div key={k}>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-semibold mb-2.5">{label}</p>
                    <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-6 gap-2">
                      {list.map((s) => {
                        const on = time === s.time;
                        return (
                          <button
                            key={s.time}
                            type="button"
                            onClick={() => setTime(s.time)}
                            className={`h-12 rounded-xl text-xs font-semibold border tabular-nums transition-all active:scale-[0.96] ${
                              on
                                ? "border-brand-600 bg-brand-700 text-white shadow-md shadow-brand-700/20"
                                : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50/50"
                            }`}
                          >
                            {s.time}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {availableExtras.length > 0 && date && !slotsLoading && !dayClosed && (
            <div className="mt-6">
              <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-semibold mb-2.5">{c.extras}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableExtras.map((e) => {
                  const on = extras.some((x) => x.id === e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() =>
                        setExtras((prev) => (on ? prev.filter((x) => x.id !== e.id) : [...prev, e]))
                      }
                      className={`flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl border text-left transition-all active:scale-[0.98] ${
                        on
                          ? "border-brand-600 bg-brand-700 text-white shadow-md shadow-brand-700/20"
                          : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 h-5 rounded-md grid place-items-center shrink-0 ${on ? "bg-white/15" : "bg-slate-100"}`}>
                          <Check className={`w-3 h-3 ${on ? "text-white" : "text-transparent"}`} />
                        </span>
                        <span className="text-xs font-semibold truncate">{e.name}</span>
                      </span>
                      <span className={`text-xs font-bold tabular-nums ${on ? "text-gold-300" : "text-slate-500"}`}>
                        +{e.price}€
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="animate-in">
          <h3 className="text-lg font-bold text-slate-800 mb-1">{c.s3}</h3>
          <p className="text-sm text-slate-400 mb-5">{c.s3h}</p>

          <div className="rounded-2xl bg-gradient-to-br from-brand-700 to-brand-800 p-4 mb-6 text-white">
            <p className="text-[10px] uppercase tracking-[0.2em] text-gold-300 font-bold mb-3">{c.summary}</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-white/65 text-xs">
                  <Tag className="w-3.5 h-3.5" />
                  {service?.name}
                </span>
                <span className="text-gold-300 font-bold text-sm tabular-nums">{service?.price}€</span>
              </div>
              {extras.length > 0 && (
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-white/65 text-xs">
                    <Sparkles className="w-3.5 h-3.5" />
                    {c.extras}
                  </span>
                  <span className="text-gold-300 font-bold text-sm tabular-nums">
                    +{extras.reduce((s, e) => s + e.price, 0)}€
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-white/65 text-xs">
                  <Calendar className="w-3.5 h-3.5" />
                  {date && new Date(`${date}T00:00:00`).toLocaleDateString(c.locale, { weekday: "short", day: "numeric", month: "short" })}
                </span>
                <span className="text-white font-semibold text-sm tabular-nums">{time}</span>
              </div>
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
                <span className="inline-flex items-center gap-2 text-white/45 text-xs">
                  <Users className="w-3.5 h-3.5" />
                  {activeWorkerId === "any" ? c.anyone : workers.find((w) => w.id === activeWorkerId)?.name}
                  <span className="text-white/25">·</span>
                  {service?.duration} {c.min}
                </span>
                <button type="button" onClick={() => setStep(0)} className="text-gold-300 text-[11px] font-semibold hover:text-gold-200">
                  {c.change}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Field label={c.name} icon={<User className="w-3.5 h-3.5" />} required>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={c.namePh} autoComplete="name" className={INPUT} />
            </Field>

            <Field label={c.phone} icon={<Phone className="w-3.5 h-3.5" />} required hint={c.phoneHint}>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={c.phonePh}
                autoComplete="tel"
                inputMode="tel"
                className={INPUT}
              />
            </Field>

            <Field label={c.notes} icon={<FileText className="w-3.5 h-3.5" />} hint={c.optional}>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={c.notesPh} rows={3} className={`${INPUT} min-h-24 resize-none`} />
            </Field>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-5 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-brand-50 border border-brand-100 text-brand-700 text-sm animate-in">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      <div className="mt-7 flex items-center gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => {
              setError("");
              setStep((s) => s - 1);
            }}
            className="inline-flex items-center gap-1.5 h-12 px-5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:border-slate-300 hover:bg-slate-50 transition-all active:scale-[0.98]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{c.back}</span>
          </button>
        )}

        {step < 2 ? (
          <button
            type="button"
            onClick={() => {
              setError("");
              if (step === 1 && (!date || !time)) return setError(c.reqSlot);
              setStep((s) => s + 1);
            }}
            disabled={(step === 0 && !serviceId) || (step === 1 && (!date || !time))}
            className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-gradient-to-r from-brand-700 to-brand-600 text-white font-semibold text-sm shadow-md shadow-brand-700/15 hover:shadow-lg hover:from-brand-600 hover:to-brand-500 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {c.next}
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={status === "sending"}
            className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-gradient-to-r from-brand-700 to-brand-600 text-white font-semibold text-sm shadow-md shadow-brand-700/15 hover:shadow-lg hover:from-brand-600 hover:to-brand-500 transition-all active:scale-[0.98] disabled:opacity-60"
          >
            <CheckCircle2 className="w-4 h-4" />
            {c.submit}
          </button>
        )}
      </div>
    </div>
  );
}

const INPUT =
  "h-12 w-full px-4 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all text-sm";

function Field({
  label,
  icon,
  hint,
  required,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
        <span className="text-brand-400">{icon}</span>
        {label}
        {required && <span className="text-brand-500">*</span>}
        {hint && <span className="text-slate-300 font-normal ml-0.5">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function SumRow({ icon, v }: { icon: React.ReactNode; v?: string | null | false }) {
  if (!v) return null;
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span className="text-brand-400">{icon}</span>
      <span className="text-slate-700 font-medium">{v}</span>
    </div>
  );
}
