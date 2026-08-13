import { translations } from "@/lib/translations";
import type { SiteContent } from "@/lib/blocks/types";

const t = translations;

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export const CONTENT_ID = "landing";

export const DEFAULT_CONTENT: SiteContent = {
  nav: {
    services: { sq: t.sq.nav_services, en: t.en.nav_services },
    gallery: { sq: t.sq.nav_gallery, en: t.en.nav_gallery },
    about: { sq: t.sq.nav_about, en: t.en.nav_about },
    contact: { sq: t.sq.nav_contact, en: t.en.nav_contact },
    book: { sq: t.sq.nav_book, en: t.en.nav_book },
  },
  brand: {
    logoSubtitle: "Nail & Beauty Studio",
  },
  hero: {
    badge: { sq: t.sq.hero_badge, en: t.en.hero_badge },
    title1: { sq: t.sq.hero_title_1, en: t.en.hero_title_1 },
    title2: { sq: t.sq.hero_title_2, en: t.en.hero_title_2 },
    title3: { sq: t.sq.hero_title_3, en: t.en.hero_title_3 },
    subtitle: { sq: t.sq.hero_subtitle, en: t.en.hero_subtitle },
    ctaPrimary: { sq: t.sq.hero_cta_primary, en: t.en.hero_cta_primary },
    bgImage: "/sroyale-header.PNG",
  },
  howItWorks: {
    steps: [
      {
        id: uid(),
        title: { sq: "Zgjidhni shërbimin", en: "Pick your service" },
        desc: {
          sq: "Lista dhe çmimet vijnë direkt nga salloni, gjithmonë të përditësuara.",
          en: "The menu and prices come straight from the salon, always current.",
        },
      },
      {
        id: uid(),
        title: { sq: "Zgjidhni stafin dhe orën", en: "Choose staff and time" },
        desc: {
          sq: "Shihni kush është i lirë dhe cilat orare janë realisht të disponueshme.",
          en: "See who's free and which times are genuinely available.",
        },
      },
      {
        id: uid(),
        title: { sq: "Termini është i konfirmuar", en: "The Appointmnet is confirmed." },
        desc: {
          sq: "Në momentin që rezervohet Termini, Konfirmohet Termini",
          en: "The moment the appointment is booked, the appointment is confirmed.",
        },
      },
    ],
  },
  services: {
    badge: { sq: t.sq.services_badge, en: t.en.services_badge },
    title: { sq: t.sq.services_title, en: t.en.services_title },
    subtitle: { sq: t.sq.services_subtitle, en: t.en.services_subtitle },
  },
  team: {
    badge: { sq: "Ekipi", en: "The Team" },
    title: { sq: "Zgjidhni specialisten tuaj", en: "Choose your specialist" },
    subtitle: {
      sq: "Rezervoni me kë dëshironi. Oraret më poshtë vijnë direkt nga sistemi i sallonit.",
      en: "Book with whoever you like. The hours below come straight from the salon system.",
    },
  },
  gallery: {
    badge: { sq: t.sq.gallery_badge, en: t.en.gallery_badge },
    title: { sq: t.sq.gallery_title, en: t.en.gallery_title },
    subtitle: { sq: t.sq.gallery_subtitle, en: t.en.gallery_subtitle },
    items: [
      { id: uid(), src: "/nailart.jpg", caption: { sq: "Nail Art", en: "Nail Art" } },
      { id: uid(), src: "/gel.jpg", caption: { sq: "Manikyr Gel Minimalist", en: "Minimalist Gel Manicure" } },
      { id: uid(), src: "/eyelash.jpg", caption: { sq: "Eyelashes", en: "Eyelashes" } },
    ],
    ctaText: { sq: "Shiko më shumë punë", en: "See more of our work" },
  },
  whyUs: {
    badge: { sq: t.sq.why_badge, en: t.en.why_badge },
    title: { sq: t.sq.why_title, en: t.en.why_title },
    subtitle: { sq: t.sq.why_subtitle, en: t.en.why_subtitle },
    cards: [
      { id: uid(), title: { sq: t.sq.why_1_title, en: t.en.why_1_title }, desc: { sq: t.sq.why_1_desc, en: t.en.why_1_desc } },
      { id: uid(), title: { sq: t.sq.why_2_title, en: t.en.why_2_title }, desc: { sq: t.sq.why_2_desc, en: t.en.why_2_desc } },
      { id: uid(), title: { sq: t.sq.why_3_title, en: t.en.why_3_title }, desc: { sq: t.sq.why_3_desc, en: t.en.why_3_desc } },
      { id: uid(), title: { sq: t.sq.why_4_title, en: t.en.why_4_title }, desc: { sq: t.sq.why_4_desc, en: t.en.why_4_desc } },
    ],
  },
  bookingIntro: {
    badge: { sq: t.sq.booking_badge, en: t.en.booking_badge },
    title: { sq: t.sq.booking_title, en: t.en.booking_title },
    subtitle: { sq: t.sq.booking_subtitle, en: t.en.booking_subtitle },
    bullets: [
      { sq: "Konfirmim të shpejtë", en: "Fast confirmation" },
      { sq: "Zgjidhni vetë specialisten", en: "Choose your own specialist" },
      { sq: "Oraret e lira në kohë reale", en: "Live availability, no guessing" },
      { sq: "Pa pagesë paraprake", en: "No upfront payment" },
    ],
    instaTitle: { sq: "Preferoni të shkruani?", en: "Prefer to message?" },
    instaDesc: {
      sq: "Na shkruani në DM. Përgjigjemi gjatë orarit të punës.",
      en: "Send us a DM. We reply during opening hours.",
    },
  },
  faq: {
    heading: { sq: "Pyetje të shpeshta", en: "Frequently asked questions" },
    subIntro: { sq: "Nuk e gjetët përgjigjen? ", en: "Didn't find your answer? " },
    subLinkText: { sq: "Na shkruani në Instagram", en: "Message us on Instagram" },
    items: [
      {
        id: uid(),
        q: { sq: "Si funksionon rezervimi online?", en: "How does online booking work?" },
        a: {
          sq: "Zgjidhni shërbimin, stafin dhe orarin e lirë, pastaj shkruani emrin dhe telefonin tuaj. Takimi shkon direkt në sistemin e sallonit dhe klienti ruhet automatikisht.",
          en: "Pick a service, a specialist and a free time slot, then enter your name and phone. The appointment goes straight into the salon system and the client is saved automatically.",
        },
      },
      {
        id: uid(),
        q: { sq: "A ruhet klienti në dashboard?", en: "Is the client saved in the dashboard?" },
        a: {
          sq: "Po. Nëse emri dhe telefoni nuk ekzistojnë te klientët, krijohet një klient i ri. I njëjti telefon lidhet edhe me takimin.",
          en: "Yes. If the name and phone do not exist in clients, a new client is created. The same phone is linked to the appointment.",
        },
      },
      {
        id: uid(),
        q: { sq: "A mund të zgjedh me kë dua të bëj takimin?", en: "Can I choose who does my nails?" },
        a: {
          sq: "Po. Në hapin e dytë shfaqet stafi që punon atë ditë me orarin përkatës. Nëse zgjidhni «Kushdo i lirë», caktohet specialistja e parë e disponueshme.",
          en: "Yes. Step two shows the staff working that day with their hours. Pick \u201cAnyone available\u201d and the first free specialist is assigned.",
        },
      },
      {
        id: uid(),
        q: { sq: "Si ju kontaktojmë nëse kemi pyetje?", en: "How do we contact you with questions?" },
        a: {
          sq: "Na shkruani në Instagram. Telefoni në formular përdoret për regjistrimin e klientit dhe takimit.",
          en: "Message us on Instagram. The phone field is used to register the client and appointment.",
        },
      },
      {
        id: uid(),
        q: { sq: "Çfarë produktesh përdorni?", en: "What products do you use?" },
        a: {
          sq: "Vetëm marka profesionale të certifikuara, pa substanca të dëmshme. Mjetet sterilizohen pas çdo klienti.",
          en: "Only certified professional brands, free from harmful substances. Every tool is sterilised after each client.",
        },
      },
    ],
  },
  contact: {
    instaDesc: {
      sq: "Shkruani në DM për rezervime dhe pyetje",
      en: "DM us for bookings and questions",
    },
    instaCta: { sq: "Hap bisedën", en: "Open chat" },
  },
};
