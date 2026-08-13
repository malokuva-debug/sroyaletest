// Content model for the visual editor. Nearly every string on this site
// has an Albanian (sq) and English (en) version, so every editable field is
// a "Bi" pair rather than a plain string. Data that comes live from the
// salon database (services, staff, hours, address, Instagram handle) is
// intentionally NOT part of this model — it stays wired to /api/salon and
// can't be edited here, same as the booking form itself.

export type Bi = { sq: string; en: string };

export type GalleryItem = { id: string; src: string; caption: Bi };
export type StepItem = { id: string; title: Bi; desc: Bi };
export type WhyCard = { id: string; title: Bi; desc: Bi };
export type FaqItem = { id: string; q: Bi; a: Bi };

export type SiteContent = {
  nav: {
    services: Bi;
    gallery: Bi;
    about: Bi;
    contact: Bi;
    book: Bi;
  };
  brand: {
    logoSubtitle: string; // not translated in the original site either
  };
  hero: {
    badge: Bi;
    title1: Bi;
    title2: Bi; // gold gradient emphasis
    title3: Bi;
    subtitle: Bi;
    ctaPrimary: Bi;
    bgImage: string;
  };
  howItWorks: {
    steps: StepItem[];
  };
  services: {
    badge: Bi;
    title: Bi;
    subtitle: Bi;
  };
  team: {
    badge: Bi;
    title: Bi;
    subtitle: Bi;
  };
  gallery: {
    badge: Bi;
    title: Bi;
    subtitle: Bi;
    items: GalleryItem[];
    ctaText: Bi; // "See more of our work"
  };
  whyUs: {
    badge: Bi;
    title: Bi;
    subtitle: Bi;
    cards: WhyCard[];
  };
  bookingIntro: {
    badge: Bi;
    title: Bi;
    subtitle: Bi;
    bullets: Bi[];
    instaTitle: Bi;
    instaDesc: Bi;
  };
  faq: {
    heading: Bi;
    subIntro: Bi;
    subLinkText: Bi;
    items: FaqItem[];
  };
  contact: {
    instaDesc: Bi;
    instaCta: Bi;
  };
};
