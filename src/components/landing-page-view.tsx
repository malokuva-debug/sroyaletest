"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import {
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Award,
  Clock,
  MapPin,
  Camera,
  Menu,
  X,
  ArrowRight,
  CheckCircle2,
  CalendarCheck,
  MousePointerClick,
  MessageCircle,
  Plus,
  Users,
  Loader2,
} from "lucide-react";
import { translations, type Language } from "@/lib/translations";
import { serviceMeta, serviceBlurb } from "@/lib/service-meta";
import type { SalonData } from "@/lib/dashboard-db";
import BookingForm from "@/components/BookingForm";
import ServiceIcon from "@/components/ServiceIcon";
import { Instagram } from "@/components/icons";
import type { SiteContent } from "@/lib/blocks/types";
import { BiText } from "@/components/editor/inline/bi-text";
import { EditableText } from "@/components/editor/inline/editable-text";
import { EditableImage } from "@/components/editor/inline/editable-image";
import { InlineAddTile, InlineRemoveButton } from "@/components/editor/inline/inline-list-controls";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

const WHY_ICONS = [
  { icon: <Sparkles className="w-5 h-5" />, tone: "bg-gold-100 text-gold-700" },
  { icon: <ShieldCheck className="w-5 h-5" />, tone: "bg-emerald-50 text-emerald-700" },
  { icon: <Award className="w-5 h-5" />, tone: "bg-sky-50 text-sky-700" },
  { icon: <Clock className="w-5 h-5" />, tone: "bg-brand-100 text-brand-700" },
] as const;

const STEP_ICONS = [
  <MousePointerClick key="s1" className="w-5 h-5" />,
  <CalendarCheck key="s2" className="w-5 h-5" />,
  <MessageCircle key="s3" className="w-5 h-5" />,
];

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function LandingPageView({
  content,
  onContentChange,
  editable = false,
  showBoth = false,
  lang: controlledLang,
  onLangChange,
}: {
  content: SiteContent;
  onContentChange?: (next: SiteContent) => void;
  editable?: boolean;
  showBoth?: boolean;
  lang?: Language;
  onLangChange?: (l: Language) => void;
}) {
  const [internalLang, setInternalLang] = useState<Language>("sq");
  const lang = controlledLang ?? internalLang;
  const setLang = useCallback(
    (updater: Language | ((prev: Language) => Language)) => {
      const next = typeof updater === "function" ? (updater as (p: Language) => Language)(lang) : updater;
      if (onLangChange) onLangChange(next);
      else setInternalLang(next);
    },
    [lang, onLangChange]
  );

  // Generic patch helper: shallow-merges a section of content and emits it.
  const patch = <K extends keyof SiteContent>(section: K, value: Partial<SiteContent[K]>) => {
    onContentChange?.({ ...content, [section]: { ...content[section], ...value } });
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [pick, setPick] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [salon, setSalon] = useState<SalonData | null>(null);
  const [loadingSalon, setLoadingSalon] = useState(true);
  const bookingRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const sheenRef = useRef<HTMLSpanElement>(null);
  const logoWrapRef = useRef<HTMLSpanElement>(null);
  const logoImgRef = useRef<HTMLImageElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const subtitleRef = useRef<HTMLSpanElement>(null);

  const t = translations[lang];

  useEffect(() => {
    let alive = true;
    fetch("/api/salon")
      .then((r) => r.json())
      .then((d: SalonData) => alive && setSalon(d))
      .catch(() => {})
      .finally(() => alive && setLoadingSalon(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const THRESHOLD = 80;
    let lastScrolled = false;

    const apply = (active: boolean) => {
      const header = headerRef.current;
      const nav = navRef.current;
      const sheen = sheenRef.current;
      const logoWrap = logoWrapRef.current;
      const logoImg = logoImgRef.current;
      const title = titleRef.current;
      const subtitle = subtitleRef.current;
      if (!header || !nav) return;

      const t = active ? 1 : 0;

      header.style.top = t ? '12px' : '0px';

      nav.style.height = t ? '56px' : (window.innerWidth >= 1024 ? '80px' : '64px');
      nav.style.paddingLeft = t ? '12px' : '32px';
      nav.style.paddingRight = t ? '12px' : '32px';
      nav.style.maxWidth = t ? 'calc(100% - 24px)' : '1280px';
      nav.style.borderRadius = t ? '9999px' : '0px';
      nav.style.border = t ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0)';
      nav.style.backgroundColor = t ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0)';
      nav.style.boxShadow = t
        ? '0 8px 32px -8px rgba(71,17,21,0.22), inset 0 1px 0 0 rgba(255,255,255,0.7)'
        : '0 8px 32px -8px rgba(71,17,21,0), inset 0 1px 0 0 rgba(255,255,255,0)';
      nav.style.backdropFilter = t ? 'blur(48px) saturate(150%)' : 'blur(0px) saturate(100%)';

      if (sheen) sheen.style.opacity = String(t);

      if (logoWrap) {
        logoWrap.style.width = t ? '36px' : '44px';
        logoWrap.style.height = t ? '36px' : '44px';
        logoWrap.style.backgroundColor = t ? 'rgba(30,27,46,1)' : 'transparent';
        logoWrap.style.boxShadow = t ? 'inset 0 0 0 1px rgba(234,179,8,0.4)' : 'none';
      }
      if (logoImg) {
        logoImg.style.width = t ? '28px' : '44px';
        logoImg.style.height = t ? '28px' : '44px';
        logoImg.style.filter = t ? 'none' : 'drop-shadow(0 2px 8px rgba(0,0,0,0.35))';
      }
      if (title) {
        title.style.fontSize = t ? '12px' : '15px';
        title.style.color = t ? '#1e293b' : 'white';
      }
      if (subtitle) {
        subtitle.style.fontSize = t ? '7px' : '9px';
        subtitle.style.color = t ? '#b45309' : 'rgba(234,179,8,0.85)';
      }
    };

    apply(false);

    const onScroll = () => {
      const y = window.scrollY;
      const scrolled = y > THRESHOLD;

      if (scrolled !== lastScrolled) {
        lastScrolled = scrolled;
        apply(scrolled);
        setScrolled(scrolled);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const goBooking = useCallback((serviceId?: string) => {
    if (serviceId) setPick(serviceId);
    setMenuOpen(false);
    requestAnimationFrame(() => bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, []);

  const goSection = useCallback((id: string) => {
    setMenuOpen(false);
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, []);

  const services = salon?.services ?? [];
  const categories = salon?.categories ?? [];
  const filteredServices = activeCategory
    ? services.filter((s) => s.categoryId === activeCategory)
    : services;
  const workers = salon?.workers ?? [];
  const preferredServiceId = salon?.preferredServiceId ?? services[0]?.id ?? null;
  const cfg = salon?.config;
  const igHandle = cfg?.instagram ?? "spartaroyale";
  const igDm = `https://ig.me/m/${igHandle}`;
  const igProfile = `https://instagram.com/${igHandle}`;

  const navItems = [
    { id: "services", value: content.nav.services, onChange: (v: typeof content.nav.services) => patch("nav", { services: v }) },
    { id: "gallery", value: content.nav.gallery, onChange: (v: typeof content.nav.gallery) => patch("nav", { gallery: v }) },
    { id: "about", value: content.nav.about, onChange: (v: typeof content.nav.about) => patch("nav", { about: v }) },
    { id: "contact", value: content.nav.contact, onChange: (v: typeof content.nav.contact) => patch("nav", { contact: v }) },
  ];

  const dayNames = lang === "sq"
    ? { 0: "E Diel", 1: "E Hënë", 2: "E Martë", 3: "E Mërkurë", 4: "E Enjte", 5: "E Premte", 6: "E Shtunë" }
    : { 0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday" };

  const patchNavBook = (v: typeof content.nav.book) => patch("nav", { book: v });

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased selection:bg-brand-100 selection:text-brand-800">
      {/* ═══════════ HEADER morphs into a floating glass pill ═══════════ */}
      <header
        ref={headerRef}
        className="fixed z-50 left-0 right-0 transition-all duration-300 ease-out"
        style={{ top: 0 }}
      >
        <nav
          ref={navRef}
          className="relative flex items-center justify-between gap-3 mx-auto transition-all duration-300 ease-out"
          style={{
            height: 80,
            paddingLeft: 32,
            paddingRight: 32,
            maxWidth: 1280,
            borderRadius: 0,
            border: '1px solid rgba(255,255,255,0)',
            backgroundColor: 'rgba(255,255,255,0)',
            boxShadow: '0 8px 32px -8px rgba(71,17,21,0), inset 0 1px 0 0 rgba(255,255,255,0)',
            backdropFilter: 'blur(0px) saturate(100%)',
          }}
        >
          {/* gold sheen that only shows in pill state */}
          <span
            ref={sheenRef}
            className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-gold-200/25 via-transparent to-brand-200/20"
            style={{ opacity: 0 }}
          />

          {/* Logo */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="relative group flex items-center gap-2.5 shrink-0"
            aria-label="Sparta Royale"
          >
            <span
              ref={logoWrapRef}
              className="relative grid place-items-center rounded-full transition-all duration-300 ease-out"
              style={{
                width: 44,
                height: 44,
                backgroundColor: 'transparent',
                boxShadow: 'none',
              }}
            >
              <Image
                ref={logoImgRef}
                src="/royale-logo.png"
                alt="Sparta Royale"
                width={44}
                height={44}
                priority
                className="object-contain group-hover:scale-105 transition-all duration-300 ease-out"
                style={{
                  width: 44,
                  height: 44,
                  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.35))',
                }}
              />
            </span>
            <span className="leading-tight text-left transition-all duration-300 ease-out">
              <span
                ref={titleRef}
                className="block font-bold tracking-[0.08em]"
                style={{ fontSize: 15, color: 'white', transition: 'all 0.3s ease-out' }}
              >
                SPARTA ROYALE
              </span>
              <span
                ref={subtitleRef}
                className="block uppercase tracking-[0.22em] font-medium"
                style={{ fontSize: 9, color: 'rgba(234,179,8,0.85)', transition: 'all 0.3s ease-out' }}
              >
                {editable ? (
                  <EditableText value={content.brand.logoSubtitle} onChange={(v) => patch("brand", { logoSubtitle: v })} />
                ) : (
                  content.brand.logoSubtitle
                )}
              </span>
            </span>
          </button>

          {/* Links */}
          <ul className="relative hidden lg:flex items-center gap-0.5">
            {navItems.map((l) => (
              <li key={l.id}>
                <button
                  onClick={() => goSection(l.id)}
                  className={`px-3.5 py-2 rounded-full text-[13px] font-medium tracking-wide ${
                    scrolled
                      ? "text-brand-900/65 hover:text-brand-800 hover:bg-brand-900/[0.06]"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <BiText value={l.value} lang={lang} editable={editable} showBoth={showBoth} onChange={l.onChange} />
                </button>
              </li>
            ))}
          </ul>

          {/* Actions */}
          <div className="relative flex items-center gap-1.5 sm:gap-2">
            <a
              href={igDm}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Instagram DM @${igHandle}`}
              className={`grid place-items-center rounded-full active:scale-95 ${
                scrolled
                  ? "w-9 h-9 text-brand-700 hover:text-white hover:bg-gradient-to-br hover:from-brand-600 hover:to-brand-800 border border-brand-900/10"
                  : "w-9 h-9 text-white/85 hover:text-white hover:bg-white/15 border border-white/20"
              }`}
            >
              <Instagram className="w-[17px] h-[17px]" />
            </a>

            <button
              onClick={() => setLang((l) => (l === "sq" ? "en" : "sq"))}
              className={`text-[10px] font-bold uppercase tracking-wider px-2.5 h-9 rounded-full border active:scale-95 ${
                scrolled
                  ? "border-brand-900/10 text-brand-900/55 hover:text-brand-800 hover:bg-brand-900/[0.06]"
                  : "border-white/20 text-white/75 hover:text-white hover:bg-white/10"
              }`}
            >
              {lang === "sq" ? "EN" : "SQ"}
            </button>

            <button
              onClick={() => goBooking()}
              className={`hidden lg:inline-flex items-center gap-1.5 rounded-full font-semibold active:scale-[0.97] ${
                scrolled
                  ? "h-9 px-4 text-[12px] bg-gradient-to-r from-brand-700 to-brand-600 text-white shadow-md shadow-brand-900/20 hover:shadow-lg"
                  : "h-10 px-5 text-[13px] bg-gradient-to-r from-gold-300 to-gold-400 text-brand-900 shadow-lg shadow-black/20 hover:from-gold-200 hover:to-gold-300"
              }`}
            >
              <BiText value={content.nav.book} lang={lang} editable={editable} showBoth={showBoth} onChange={patchNavBook} />
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setMenuOpen((o) => !o)}
              className={`lg:hidden grid place-items-center w-9 h-9 rounded-full ${
                scrolled ? "text-brand-800 hover:bg-brand-900/[0.06]" : "text-white hover:bg-white/10"
              }`}
              aria-label="Menu"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>

        {/* Mobile sheet */}
        {menuOpen && (
          <div
            className={`lg:hidden animate-in overflow-hidden ${
              scrolled
                ? "mt-2 rounded-3xl border border-white/50 bg-white/85 backdrop-blur-2xl shadow-[0_16px_48px_-12px_rgba(71,17,21,0.3)]"
                : "bg-white/95 backdrop-blur-2xl border-t border-white/40 shadow-2xl"
            }`}
          >
            <div className="px-3 py-3 space-y-0.5">
              {navItems.map((l) => (
                <button
                  key={l.id}
                  onClick={() => goSection(l.id)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-slate-700 font-medium hover:bg-brand-50 hover:text-brand-700 transition-colors"
                >
                  <BiText value={l.value} lang={lang} editable={editable} showBoth={showBoth} onChange={l.onChange} />
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </button>
              ))}
              <div className="pt-2 space-y-2">
                <button
                  onClick={() => goBooking()}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-700 to-brand-600 text-white font-semibold shadow-md active:scale-[0.98] transition-transform"
                >
                  <BiText value={content.nav.book} lang={lang} editable={editable} showBoth={showBoth} onChange={patchNavBook} />
                </button>
                <a
                  href={igDm}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-slate-200 text-slate-600 font-semibold text-sm"
                >
                  <Instagram className="w-4 h-4" />@{igHandle}
                </a>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ═══════════ HERO ═══════════ */}
      <section id="home" className="relative min-h-[100svh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          {editable ? (
            <EditableImage
              src={content.hero.bgImage}
              alt=""
              onChange={(v) => patch("hero", { bgImage: v })}
              className="absolute inset-0"
              imgClassName="object-cover object-center"
              fill
            />
          ) : (
            <Image src={content.hero.bgImage} alt="" fill priority sizes="100vw" className="object-cover object-center" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-950/85 via-brand-900/60 to-brand-700/40" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/25 to-brand-950/50" />
        </div>
        <div className="absolute top-1/4 right-[8%] w-72 h-72 rounded-full bg-gold-300/8 blur-[120px]" />
        <div className="absolute -bottom-20 left-[2%] w-96 h-96 rounded-full bg-brand-400/12 blur-[140px]" />

        <div className="relative z-10 w-full mx-auto max-w-7xl px-5 sm:px-6 lg:px-8 pt-24 pb-16">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gold-300/12 border border-gold-300/25 text-gold-300 text-[10px] font-bold uppercase tracking-[0.2em] mb-7 backdrop-blur-sm">
              <Sparkles className="w-3 h-3" />
              <BiText value={content.hero.badge} lang={lang} editable={editable} showBoth={showBoth} onChange={(v) => patch("hero", { badge: v })} />
            </span>

            <h1 className="text-[2.6rem] leading-[1.05] sm:text-6xl lg:text-[4.5rem] font-bold text-white tracking-tight mb-6">
              <BiText value={content.hero.title1} lang={lang} editable={editable} showBoth={showBoth} onChange={(v) => patch("hero", { title1: v })} />{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-br from-gold-200 via-gold-300 to-gold-500">
                <BiText value={content.hero.title2} lang={lang} editable={editable} showBoth={showBoth} onChange={(v) => patch("hero", { title2: v })} />
              </span>
              <br />
              <BiText value={content.hero.title3} lang={lang} editable={editable} showBoth={showBoth} onChange={(v) => patch("hero", { title3: v })} />
            </h1>

            <p className="text-white/65 text-base sm:text-lg max-w-lg mb-9 leading-relaxed font-light">
              <BiText
                value={content.hero.subtitle}
                lang={lang}
                editable={editable}
                showBoth={showBoth}
                multiline
                onChange={(v) => patch("hero", { subtitle: v })}
              />
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-14">
              <button
                onClick={() => goBooking()}
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-gradient-to-r from-gold-300 to-gold-400 text-brand-900 font-bold text-[15px] shadow-2xl shadow-gold-600/25 hover:shadow-gold-400/40 hover:from-gold-200 hover:to-gold-300 transition-all duration-300 active:scale-[0.97]"
              >
                <BiText value={content.hero.ctaPrimary} lang={lang} editable={editable} showBoth={showBoth} onChange={(v) => patch("hero", { ctaPrimary: v })} />
                <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href={editable ? undefined : igDm}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-white/8 border border-white/15 text-white font-semibold text-[15px] backdrop-blur-md hover:bg-white/15 hover:border-white/30 transition-all active:scale-[0.97]"
              >
                <Instagram className="w-4 h-4" />@{igHandle}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section className="relative -mt-px bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative -translate-y-10 lg:-translate-y-14 grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
            {content.howItWorks.steps.map((s, i) => (
              <div key={s.id} className="group/item relative rounded-2xl bg-white border border-slate-100 shadow-[0_8px_30px_-12px_rgba(71,17,21,0.18)] p-5 lg:p-6">
                {editable && (
                  <InlineRemoveButton
                    onRemove={() =>
                      patch("howItWorks", { steps: content.howItWorks.steps.filter((x) => x.id !== s.id) })
                    }
                  />
                )}
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center shrink-0">
                    {STEP_ICONS[i] ?? STEP_ICONS[STEP_ICONS.length - 1]}
                  </span>
                  <span className="text-[10px] font-bold text-slate-300 tabular-nums">0{i + 1}</span>
                </div>
                <h3 className="font-bold text-slate-800 text-[15px] mb-1.5">
                  <BiText
                    value={s.title}
                    lang={lang}
                    editable={editable}
                    showBoth={showBoth}
                    onChange={(v) =>
                      patch("howItWorks", { steps: content.howItWorks.steps.map((x) => (x.id === s.id ? { ...x, title: v } : x)) })
                    }
                  />
                </h3>
                <p className="text-slate-400 text-[13px] leading-relaxed">
                  <BiText
                    value={s.desc}
                    lang={lang}
                    editable={editable}
                    showBoth={showBoth}
                    multiline
                    onChange={(v) =>
                      patch("howItWorks", { steps: content.howItWorks.steps.map((x) => (x.id === s.id ? { ...x, desc: v } : x)) })
                    }
                  />
                </p>
              </div>
            ))}
            {editable && (
              <InlineAddTile
                label="Step"
                className="min-h-[140px]"
                onAdd={() =>
                  patch("howItWorks", {
                    steps: [
                      ...content.howItWorks.steps,
                      { id: uid(), title: { sq: "Hap i ri", en: "New step" }, desc: { sq: "Përshkrimi…", en: "Description…" } },
                    ],
                  })
                }
              />
            )}
          </div>
        </div>
      </section>

      {/* ═══════════ SERVICES from database ═══════════ */}
      <section id="services" className="scroll-mt-24 pt-4 pb-20 sm:pb-28 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            badge={<BiText value={content.services.badge} lang={lang} editable={editable} showBoth={showBoth} onChange={(v) => patch("services", { badge: v })} />}
            icon={<Sparkles className="w-3 h-3" />}
            title={<BiText value={content.services.title} lang={lang} editable={editable} showBoth={showBoth} onChange={(v) => patch("services", { title: v })} />}
            sub={<BiText value={content.services.subtitle} lang={lang} editable={editable} showBoth={showBoth} multiline onChange={(v) => patch("services", { subtitle: v })} />}
          />

          {loadingSalon ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-slate-100 p-6 animate-pulse">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 mb-5" />
                  <div className="h-4 bg-slate-100 rounded w-2/3 mb-3" />
                  <div className="h-3 bg-slate-50 rounded w-full mb-2" />
                  <div className="h-3 bg-slate-50 rounded w-4/5 mb-6" />
                  <div className="h-6 bg-slate-100 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : services.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center">
              <Loader2 className="w-6 h-6 text-slate-300 mx-auto mb-3 animate-spin" />
              <p className="text-slate-400 text-sm">
                {lang === "sq" ? "Shërbimet po sinkronizohen..." : "Services are syncing..."}
              </p>
            </div>
          ) : (
            <>
              {categories.length > 1 && (
                <div className="flex flex-wrap justify-center gap-2 mb-10">
                  <button
                    onClick={() => setActiveCategory("")}
                    className={`px-4 py-2 rounded-full text-[12px] font-semibold transition-all ${
                      activeCategory === ""
                        ? "bg-brand-700 text-white shadow-sm"
                        : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {lang === "sq" ? "Të gjitha" : "All"}
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setActiveCategory(activeCategory === c.id ? "" : c.id)}
                      className={`px-4 py-2 rounded-full text-[12px] font-semibold transition-all ${
                        activeCategory === c.id
                          ? "bg-brand-700 text-white shadow-sm"
                          : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
              {filteredServices.map((s) => {
                const meta = serviceMeta(s.name);
                const preferred = s.id === preferredServiceId;
                return (
                  <button
                    key={s.id}
                    onClick={() => goBooking(s.id)}
                    className={`group relative text-left rounded-2xl p-5 lg:p-6 bg-gradient-to-br ${meta.card} border border-slate-100 hover:border-slate-200 shadow-[0_2px_12px_-6px_rgba(71,17,21,0.1)] hover:shadow-[0_16px_36px_-18px_rgba(71,17,21,0.28)] hover:-translate-y-1 transition-all duration-300`}
                  >
                    {preferred && (
                      <span className="absolute top-4 right-4 text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-1 rounded-full bg-gold-100 text-gold-700 border border-gold-200/70">
                        {lang === "sq" ? "Më i zgjedhur" : "Most booked"}
                      </span>
                    )}
                    <span className={`inline-flex w-11 h-11 rounded-xl items-center justify-center mb-5 bg-white shadow-sm ${meta.text}`}>
                      <ServiceIcon name={meta.icon} />
                    </span>
                    <h3 className="font-bold text-slate-800 text-[17px] mb-2 leading-snug">{s.name}</h3>
                    <p className="text-slate-500 text-[13px] leading-relaxed mb-5 min-h-[2.6rem]">
                      {serviceBlurb(s.name, lang)}
                    </p>
                    <div className="flex items-end justify-between pt-4 border-t border-slate-900/5">
                      <div>
                        <span className="block text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">
                          {lang === "sq" ? "Nga" : "From"}
                        </span>
                        <span className={`text-xl font-bold tabular-nums ${meta.text}`}>{s.price}€</span>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 mb-1.5">
                          <Clock className="w-3 h-3" />{s.duration} min
                        </span>
                        <span className="flex items-center justify-end gap-1 text-[12px] font-semibold text-brand-700 transition-all group-hover:gap-2">
                          {t.service_book_now}<ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
              </div>
              {activeCategory && filteredServices.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center mt-3">
                  <p className="text-slate-400 text-sm">
                    {lang === "sq" ? "Nuk ka shërbime në këtë kategori." : "No services in this category yet."}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ═══════════ TEAM from database ═══════════ */}
      {workers.length > 0 && (
        <section className="py-16 sm:py-20 bg-gradient-to-b from-brand-50/40 to-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-xl mx-auto mb-10">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 text-brand-600 text-[10px] font-bold uppercase tracking-[0.2em] mb-4 border border-brand-100">
                <Users className="w-3 h-3" />
                <BiText value={content.team.badge} lang={lang} editable={editable} showBoth={showBoth} onChange={(v) => patch("team", { badge: v })} />
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-brand-800 tracking-tight mb-3">
                <BiText value={content.team.title} lang={lang} editable={editable} showBoth={showBoth} onChange={(v) => patch("team", { title: v })} />
              </h2>
              <p className="text-slate-500 text-[15px] leading-relaxed">
                <BiText
                  value={content.team.subtitle}
                  lang={lang}
                  editable={editable}
                  showBoth={showBoth}
                  multiline
                  onChange={(v) => patch("team", { subtitle: v })}
                />
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {workers.map((w) => (
                <button
                  key={w.id}
                  onClick={() => goBooking()}
                  className="group flex items-center gap-3.5 pl-3 pr-5 py-3 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_12px_-6px_rgba(71,17,21,0.12)] hover:shadow-[0_14px_32px_-16px_rgba(71,17,21,0.28)] hover:-translate-y-0.5 transition-all"
                >
                  <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-700 to-brand-900 text-gold-300 grid place-items-center font-bold text-base shrink-0 ring-1 ring-gold-300/20">
                    {w.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-left">
                    <span className="block font-bold text-slate-800 text-sm">{w.name}</span>
                    <span className="block text-[11px] text-slate-400 tabular-nums">
                      {w.days.length}/7 {lang === "sq" ? "ditë" : "days"} · {w.start}–{w.end}
                    </span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ GALLERY ═══════════ */}
      <section id="gallery" className="scroll-mt-24 py-20 sm:py-28 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            badge={<BiText value={content.gallery.badge} lang={lang} editable={editable} showBoth={showBoth} onChange={(v) => patch("gallery", { badge: v })} />}
            icon={<Camera className="w-3 h-3" />}
            title={<BiText value={content.gallery.title} lang={lang} editable={editable} showBoth={showBoth} onChange={(v) => patch("gallery", { title: v })} />}
            sub={<BiText value={content.gallery.subtitle} lang={lang} editable={editable} showBoth={showBoth} multiline onChange={(v) => patch("gallery", { subtitle: v })} />}
          />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {content.gallery.items.map((g, i) => {
              const updateItem = (patchFields: Partial<typeof g>) =>
                patch("gallery", { items: content.gallery.items.map((x) => (x.id === g.id ? { ...x, ...patchFields } : x)) });
              const large = i === 0;
              return (
                <figure
                  key={g.id}
                  className={`group/item group relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 to-brand-600 ${
                    large
                      ? "col-span-2 lg:row-span-2 aspect-square lg:aspect-auto lg:min-h-[420px]"
                      : "aspect-square lg:aspect-auto lg:min-h-[202px]"
                  }`}
                >
                  {editable ? (
                    <EditableImage
                      src={g.src}
                      alt={g.caption[lang]}
                      onChange={(v) => updateItem({ src: v })}
                      className="absolute inset-0"
                      imgClassName="object-cover"
                      fill
                    />
                  ) : (
                    <Image
                      src={g.src}
                      alt={g.caption[lang]}
                      fill
                      sizes={large ? "(max-width:1024px) 100vw, 50vw" : "(max-width:1024px) 50vw, 25vw"}
                      className="object-cover transition-transform duration-[900ms] group-hover:scale-[1.06]"
                    />
                  )}
                  <div
                    className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${
                      large ? "from-brand-950/75 via-brand-950/10 to-transparent" : "from-brand-950/70 to-transparent opacity-80 group-hover:opacity-100 transition-opacity"
                    }`}
                  />
                  <figcaption className={`absolute text-white ${large ? "bottom-5 left-5 right-5 font-semibold text-sm" : "bottom-4 left-4 right-4 font-medium text-[13px]"}`}>
                    <BiText value={g.caption} lang={lang} editable={editable} showBoth={showBoth} onChange={(v) => updateItem({ caption: v })} />
                  </figcaption>
                  {editable && (
                    <InlineRemoveButton onRemove={() => patch("gallery", { items: content.gallery.items.filter((x) => x.id !== g.id) })} />
                  )}
                </figure>
              );
            })}

            {editable && (
              <InlineAddTile
                label="Photo"
                className="aspect-square lg:min-h-[202px]"
                onAdd={() =>
                  patch("gallery", {
                    items: [...content.gallery.items, { id: uid(), src: "/nailart.jpg", caption: { sq: "Foto e re", en: "New photo" } }],
                  })
                }
              />
            )}

            <a
              href={editable ? undefined : igProfile}
              target="_blank"
              rel="noopener noreferrer"
              className="col-span-2 group relative rounded-2xl overflow-hidden bg-gradient-to-br from-brand-800 to-brand-950 p-6 flex flex-col items-center justify-center gap-2.5 min-h-[202px] transition-all hover:shadow-[0_16px_40px_-18px_rgba(71,17,21,0.5)]"
            >
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(232,208,160,0.12),transparent_60%)]" />
              <span className="relative w-12 h-12 rounded-full bg-white/10 border border-gold-300/25 grid place-items-center text-gold-300 group-hover:scale-105 transition-transform">
                <Instagram className="w-5 h-5" />
              </span>
              <span className="relative text-white font-semibold text-sm">
                <BiText value={content.gallery.ctaText} lang={lang} editable={editable} showBoth={showBoth} onChange={(v) => patch("gallery", { ctaText: v })} />
              </span>
              <span className="relative text-gold-300/70 text-xs tracking-wide">@{igHandle}</span>
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════ WHY US ═══════════ */}
      <section id="about" className="scroll-mt-24 relative py-20 sm:py-28 overflow-hidden bg-gradient-to-br from-brand-950 via-brand-800 to-brand-700">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(232,208,160,0.07),transparent_55%)]" />
        <div className="absolute -top-32 right-0 w-[520px] h-[520px] rounded-full bg-gold-300/5 blur-[160px]" />
        <div className="absolute -bottom-32 -left-20 w-[420px] h-[420px] rounded-full bg-brand-500/20 blur-[140px]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gold-300/12 border border-gold-300/20 text-gold-300 text-[10px] font-bold uppercase tracking-[0.2em] mb-5">
              <Award className="w-3 h-3" />
              <BiText value={content.whyUs.badge} lang={lang} editable={editable} showBoth={showBoth} onChange={(v) => patch("whyUs", { badge: v })} />
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-white mb-4 tracking-tight leading-tight">
              <BiText value={content.whyUs.title} lang={lang} editable={editable} showBoth={showBoth} onChange={(v) => patch("whyUs", { title: v })} />
            </h2>
            <p className="text-white/50 leading-relaxed text-[15px] sm:text-base">
              <BiText value={content.whyUs.subtitle} lang={lang} editable={editable} showBoth={showBoth} multiline onChange={(v) => patch("whyUs", { subtitle: v })} />
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-16">
            {content.whyUs.cards.map((w, i) => {
              const iconMeta = WHY_ICONS[i] ?? WHY_ICONS[WHY_ICONS.length - 1];
              const updateCard = (patchFields: Partial<typeof w>) =>
                patch("whyUs", { cards: content.whyUs.cards.map((x) => (x.id === w.id ? { ...x, ...patchFields } : x)) });
              return (
                <div key={w.id} className="group/item group relative rounded-2xl bg-white/[0.04] backdrop-blur-sm border border-white/[0.07] p-6 hover:bg-white/[0.08] hover:border-white/15 transition-all duration-300">
                  {editable && (
                    <InlineRemoveButton onRemove={() => patch("whyUs", { cards: content.whyUs.cards.filter((x) => x.id !== w.id) })} />
                  )}
                  <span className={`inline-flex w-11 h-11 rounded-xl items-center justify-center mb-5 ${iconMeta.tone} transition-transform duration-300 group-hover:scale-105`}>
                    {iconMeta.icon}
                  </span>
                  <h3 className="font-bold text-white text-[15px] mb-2">
                    <BiText value={w.title} lang={lang} editable={editable} showBoth={showBoth} onChange={(v) => updateCard({ title: v })} />
                  </h3>
                  <p className="text-white/45 text-[13px] leading-relaxed">
                    <BiText value={w.desc} lang={lang} editable={editable} showBoth={showBoth} multiline onChange={(v) => updateCard({ desc: v })} />
                  </p>
                </div>
              );
            })}
            {editable && (
              <InlineAddTile
                label="Card"
                className="min-h-[140px]"
                onAdd={() =>
                  patch("whyUs", {
                    cards: [...content.whyUs.cards, { id: uid(), title: { sq: "Karta e re", en: "New card" }, desc: { sq: "Përshkrimi…", en: "Description…" } }],
                  })
                }
              />
            )}
          </div>        </div>
      </section>

      {/* ═══════════ BOOKING ═══════════ */}
      <section id="booking" ref={bookingRef} className="scroll-mt-20 py-20 sm:py-28 bg-gradient-to-b from-brand-50/50 via-white to-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">
            <aside className="lg:col-span-4">
              <div className="lg:sticky lg:top-28">
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 text-brand-600 text-[10px] font-bold uppercase tracking-[0.2em] mb-5 border border-brand-100">
                  <CalendarCheck className="w-3 h-3" />
                  <BiText value={content.bookingIntro.badge} lang={lang} editable={editable} showBoth={showBoth} onChange={(v) => patch("bookingIntro", { badge: v })} />
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold text-brand-800 mb-4 tracking-tight leading-[1.15]">
                  <BiText value={content.bookingIntro.title} lang={lang} editable={editable} showBoth={showBoth} onChange={(v) => patch("bookingIntro", { title: v })} />
                </h2>
                <p className="text-slate-500 leading-relaxed mb-8 text-[15px]">
                  <BiText value={content.bookingIntro.subtitle} lang={lang} editable={editable} showBoth={showBoth} multiline onChange={(v) => patch("bookingIntro", { subtitle: v })} />
                </p>

                <ul className="space-y-2.5 mb-7">
                  {content.bookingIntro.bullets.map((p, i) => (
                    <li key={i} className="group/item relative flex items-center gap-3 px-3.5 py-3 rounded-xl bg-white border border-slate-100 shadow-[0_2px_10px_-6px_rgba(71,17,21,0.12)]">
                      <span className="p-1 rounded-md bg-emerald-50 text-emerald-600 shrink-0"><CheckCircle2 className="w-3.5 h-3.5" /></span>
                      <span className="text-slate-600 text-[13px] font-medium">
                        <BiText
                          value={p}
                          lang={lang}
                          editable={editable}
                          showBoth={showBoth}
                          onChange={(v) =>
                            patch("bookingIntro", { bullets: content.bookingIntro.bullets.map((x, idx) => (idx === i ? v : x)) })
                          }
                        />
                      </span>
                      {editable && (
                        <InlineRemoveButton
                          onRemove={() => patch("bookingIntro", { bullets: content.bookingIntro.bullets.filter((_, idx) => idx !== i) })}
                        />
                      )}
                    </li>
                  ))}
                  {editable && (
                    <InlineAddTile
                      label="Bullet"
                      className="h-10 w-full"
                      onAdd={() =>
                        patch("bookingIntro", { bullets: [...content.bookingIntro.bullets, { sq: "Pikë e re", en: "New point" }] })
                      }
                    />
                  )}
                </ul>

                <div className="rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 p-5 text-white relative overflow-hidden">
                  <span className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(232,208,160,0.14),transparent_60%)]" />
                  <p className="relative text-gold-300 text-[10px] font-bold uppercase tracking-[0.2em] mb-2">
                    <BiText value={content.bookingIntro.instaTitle} lang={lang} editable={editable} showBoth={showBoth} onChange={(v) => patch("bookingIntro", { instaTitle: v })} />
                  </p>
                  <p className="relative text-white/60 text-[13px] leading-relaxed mb-4">
                    <BiText value={content.bookingIntro.instaDesc} lang={lang} editable={editable} showBoth={showBoth} multiline onChange={(v) => patch("bookingIntro", { instaDesc: v })} />
                  </p>
                  <a
                    href={editable ? undefined : igDm}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white font-semibold text-[13px] hover:bg-white/20 transition-colors"
                  >
                    <Instagram className="w-3.5 h-3.5" />@{igHandle}
                  </a>
                </div>
              </div>
            </aside>

            <div className="lg:col-span-8">
              <div className="rounded-2xl lg:rounded-3xl bg-white border border-slate-100 shadow-[0_24px_60px_-30px_rgba(71,17,21,0.25)] p-5 sm:p-8 lg:p-10">
                <BookingForm lang={lang} salon={salon} loading={loadingSalon} preselect={pick} onConsumed={() => setPick("")} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ FAQ ═══════════ */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-brand-800 tracking-tight mb-3">
              <BiText value={content.faq.heading} lang={lang} editable={editable} showBoth={showBoth} onChange={(v) => patch("faq", { heading: v })} />
            </h2>
            <p className="text-slate-400 text-sm">
              <BiText value={content.faq.subIntro} lang={lang} editable={editable} showBoth={showBoth} onChange={(v) => patch("faq", { subIntro: v })} />
              <a href={editable ? undefined : igDm} target="_blank" rel="noopener noreferrer" className="text-brand-600 font-semibold hover:text-brand-700 underline underline-offset-2 decoration-brand-200">
                <BiText value={content.faq.subLinkText} lang={lang} editable={editable} showBoth={showBoth} onChange={(v) => patch("faq", { subLinkText: v })} />
              </a>
            </p>
          </div>

          <div className="divide-y divide-slate-100 border-y border-slate-100">
            {content.faq.items.map((f, i) => {
              const open = openFaq === i;
              const updateItem = (patchFields: Partial<typeof f>) =>
                patch("faq", { items: content.faq.items.map((x) => (x.id === f.id ? { ...x, ...patchFields } : x)) });
              return (
                <div key={f.id} className="group/item relative">
                  <button onClick={() => !editable && setOpenFaq(open ? null : i)} className="w-full flex items-start justify-between gap-4 py-5 text-left group">
                    <span className={`font-semibold text-[15px] transition-colors ${open ? "text-brand-800" : "text-slate-700 group-hover:text-brand-700"}`}>
                      <BiText value={f.q} lang={lang} editable={editable} showBoth={showBoth} onChange={(v) => updateItem({ q: v })} />
                    </span>
                    <span className={`shrink-0 mt-0.5 w-6 h-6 rounded-full border grid place-items-center transition-all duration-300 ${open ? "rotate-45 border-brand-600 bg-brand-600 text-white" : "border-slate-200 text-slate-400 group-hover:border-brand-300"}`}>
                      <Plus className="w-3.5 h-3.5" />
                    </span>
                  </button>
                  <div className={`grid transition-all duration-300 ease-out ${open || editable ? "grid-rows-[1fr] opacity-100 pb-5" : "grid-rows-[0fr] opacity-0"}`}>
                    <div className="overflow-hidden">
                      <p className="text-slate-500 text-[14px] leading-relaxed pr-10">
                        <BiText value={f.a} lang={lang} editable={editable} showBoth={showBoth} multiline onChange={(v) => updateItem({ a: v })} />
                      </p>
                    </div>
                  </div>
                  {editable && (
                    <InlineRemoveButton
                      label="Remove question"
                      onRemove={() => patch("faq", { items: content.faq.items.filter((x) => x.id !== f.id) })}
                    />
                  )}
                </div>
              );
            })}
            {editable && (
              <InlineAddTile
                label="Question"
                className="my-3 h-12 w-full"
                onAdd={() =>
                  patch("faq", {
                    items: [
                      ...content.faq.items,
                      { id: uid(), q: { sq: "Pyetje e re?", en: "New question?" }, a: { sq: "Përgjigja…", en: "Answer…" } },
                    ],
                  })
                }
              />
            )}
          </div>
        </div>
      </section>

      {/* ═══════════ CONTACT hours from database ═══════════ */}
      <section id="contact" className="scroll-mt-24 py-16 sm:py-20 bg-brand-50/40 border-t border-brand-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
            <div className="rounded-2xl bg-white p-6 border border-slate-100 shadow-[0_2px_12px_-6px_rgba(71,17,21,0.1)]">
              <span className="inline-flex w-10 h-10 rounded-xl bg-brand-50 text-brand-700 items-center justify-center mb-4"><MapPin className="w-5 h-5" /></span>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold mb-2.5 text-brand-400">{t.contact_address}</p>
              <p className="font-semibold text-slate-800 text-sm">{cfg?.address ?? "Rr. Kacaniku, Nr. 17"}</p>
              <p className="text-slate-400 text-xs mt-1">{cfg?.city ?? "Prishtinë, Kosovë"}</p>
            </div>

            <div className="rounded-2xl bg-white p-6 border border-slate-100 shadow-[0_2px_12px_-6px_rgba(71,17,21,0.1)]">
              <span className="inline-flex w-10 h-10 rounded-xl bg-gold-100 text-gold-700 items-center justify-center mb-4"><Clock className="w-5 h-5" /></span>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold mb-3 text-gold-600">{t.contact_hours_title}</p>
              <ul className="space-y-1.5">
                {DAY_ORDER.map((d) => {
                  const h = cfg?.hours?.[String(d)];
                  return (
                    <li key={d} className="flex justify-between text-[13px]">
                      <span className="text-slate-500">{dayNames[d as keyof typeof dayNames]}</span>
                      {h ? (
                        <span className="font-semibold text-slate-800 tabular-nums">{h.open} – {h.close}</span>
                      ) : (
                        <span className="font-medium text-slate-300">{t.contact_closed}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <a
              href={editable ? undefined : igDm}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-2xl bg-gradient-to-br from-brand-800 to-brand-950 p-6 border border-brand-900 shadow-[0_2px_12px_-6px_rgba(71,17,21,0.2)] hover:shadow-[0_16px_40px_-18px_rgba(71,17,21,0.5)] transition-all relative overflow-hidden"
            >
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_75%_15%,rgba(232,208,160,0.14),transparent_60%)]" />
              <span className="relative inline-flex w-10 h-10 rounded-xl bg-white/10 border border-gold-300/25 text-gold-300 items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Instagram className="w-5 h-5" />
              </span>
              <p className="relative text-[10px] uppercase tracking-[0.2em] font-bold mb-2.5 text-gold-400">Instagram</p>
              <p className="relative font-bold text-white text-lg">@{igHandle}</p>
              <p className="relative text-white/45 text-xs mt-1.5 leading-relaxed">
                <BiText value={content.contact.instaDesc} lang={lang} editable={editable} showBoth={showBoth} multiline onChange={(v) => patch("contact", { instaDesc: v })} />
              </p>
              <span className="relative mt-4 inline-flex items-center gap-1.5 text-gold-300 text-[12px] font-semibold group-hover:gap-2.5 transition-all">
                <BiText value={content.contact.instaCta} lang={lang} editable={editable} showBoth={showBoth} onChange={(v) => patch("contact", { instaCta: v })} />
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="bg-brand-950 text-white z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-800 to-brand-950 ring-1 ring-gold-300/25 grid place-items-center shrink-0">
                <Image src="/royale-logo.png" alt="Sparta Royale" width={36} height={36} className="w-7 h-7 object-contain" />
              </span>
              <span className="leading-tight">
                <span className="block font-bold text-white tracking-[0.08em] text-[13px]">SPARTA ROYALE</span>
                <span className="block text-gold-400/80 text-[8px] uppercase tracking-[0.22em]">
                  {editable ? (
                    <EditableText value={content.brand.logoSubtitle} onChange={(v) => patch("brand", { logoSubtitle: v })} />
                  ) : (
                    content.brand.logoSubtitle
                  )}
                </span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-white/40">
              {navItems.map((l) => (
                <button key={l.id} onClick={() => goSection(l.id)} className="hover:text-gold-300 transition-colors">
                  <BiText value={l.value} lang={lang} editable={editable} showBoth={showBoth} onChange={l.onChange} />
                </button>
              ))}
              <button onClick={() => goBooking()} className="text-gold-300 font-semibold hover:text-gold-200 transition-colors">
                <BiText value={content.nav.book} lang={lang} editable={editable} showBoth={showBoth} onChange={patchNavBook} />
              </button>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-white/20">
            <span>&copy; {new Date().getFullYear()} Sparta Royale</span>
            <span>{cfg?.address ?? "Rr. Kacaniku, Nr. 17"} · {cfg?.city ?? "Prishtinë, Kosovë"}</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

function SectionHead({ badge, icon, title, sub }: { badge: React.ReactNode; icon: React.ReactNode; title: React.ReactNode; sub: React.ReactNode }) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-12 lg:mb-14">
      <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 text-brand-600 text-[10px] font-bold uppercase tracking-[0.2em] mb-5 border border-brand-100">
        {icon}{badge}
      </span>
      <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-brand-800 mb-4 tracking-tight leading-tight">{title}</h2>
      <p className="text-slate-500 leading-relaxed text-[15px] sm:text-base">{sub}</p>
    </div>
  );
}
