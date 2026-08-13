/**
 * Presentation layer for services.
 * Services live in the dashboard database. This maps each service name to an
 * icon and colour treatment so new services still render cleanly.
 */

export type IconName = "brush" | "gem" | "paint" | "flower" | "scissors" | "droplets" | "sparkles";

export interface Meta {
  icon: IconName;
  chip: string;
  text: string;
  card: string;
  blurbSq: string;
  blurbEn: string;
}

const PRESETS: Record<string, Meta> = {
  gel: {
    icon: "gem",
    chip: "bg-gold-100 text-gold-700",
    text: "text-gold-700",
    card: "from-gold-50 to-white",
    blurbSq: "Thonjë rezistentë me shkëlqim të pastër që qëndron bukur.",
    blurbEn: "Durable nails with a clean shine and a polished finish.",
  },
  art: {
    icon: "paint",
    chip: "bg-brand-50 text-brand-700",
    text: "text-brand-700",
    card: "from-brand-50/70 to-white",
    blurbSq: "Dizajne të personalizuara, nga minimalizmi elegant te detajet fine.",
    blurbEn: "Personalised designs, from elegant minimalism to fine detail work.",
  },
  pedi: {
    icon: "flower",
    chip: "bg-emerald-50 text-emerald-700",
    text: "text-emerald-700",
    card: "from-emerald-50 to-white",
    blurbSq: "Trajtim i plotë me kujdes, masazh relaksues dhe finish të pastër.",
    blurbEn: "A complete treatment with careful prep, relaxing massage and clean finish.",
  },
  acryl: {
    icon: "scissors",
    chip: "bg-sky-50 text-sky-700",
    text: "text-sky-700",
    card: "from-sky-50 to-white",
    blurbSq: "Zgjatim profesional për formën dhe gjatësinë që dëshironi.",
    blurbEn: "Professional extensions for the exact shape and length you want.",
  },
  removal: {
    icon: "droplets",
    chip: "bg-teal-50 text-teal-700",
    text: "text-teal-700",
    card: "from-teal-50 to-white",
    blurbSq: "Heqje e sigurt e gelit ose akrilikut me trajtim ushqyes pas saj.",
    blurbEn: "Safe gel or acrylic removal followed by a nourishing treatment.",
  },
  mani: {
    icon: "brush",
    chip: "bg-brand-50 text-brand-600",
    text: "text-brand-700",
    card: "from-brand-50/70 to-white",
    blurbSq: "Trajtim i plotë i duarve me përgatitje të kujdesshme dhe llak cilësor.",
    blurbEn: "Complete hand treatment with careful prep and quality lacquer.",
  },
  default: {
    icon: "sparkles",
    chip: "bg-brand-50 text-brand-600",
    text: "text-brand-700",
    card: "from-brand-50/60 to-white",
    blurbSq: "Trajtim profesional me produkte premium dhe kujdes maksimal.",
    blurbEn: "A professional treatment using premium products and careful technique.",
  },
};

export function serviceMeta(name: string): Meta {
  const n = (name || "").toLowerCase();
  if (/heqj|removal|trajtim/.test(n)) return PRESETS.removal;
  if (/akrilik|acryl|zgjat|extension/.test(n)) return PRESETS.acryl;
  if (/pedik|pedic/.test(n)) return PRESETS.pedi;
  if (/art|dizajn|design/.test(n)) return PRESETS.art;
  if (/gel|shellac|xhel/.test(n)) return PRESETS.gel;
  if (/manik|manic/.test(n)) return PRESETS.mani;
  return PRESETS.default;
}

export function serviceBlurb(name: string, lang: "sq" | "en"): string {
  const m = serviceMeta(name);
  return lang === "sq" ? m.blurbSq : m.blurbEn;
}
