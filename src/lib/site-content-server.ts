import { supabase } from "@/lib/supabase.js";
import { CONTENT_ID, DEFAULT_CONTENT } from "@/lib/blocks/defaults";
import type { SiteContent } from "@/lib/blocks/types";

const TABLE = "site_content";

// Deep-merge fetched content over the defaults so newly added fields never
// crash on older stored rows, and partial/corrupt rows still render.
function normalize(raw: unknown): SiteContent {
  if (!raw || typeof raw !== "object") return DEFAULT_CONTENT;
  const r = raw as Partial<SiteContent>;
  return {
    nav: { ...DEFAULT_CONTENT.nav, ...(r.nav ?? {}) },
    brand: { ...DEFAULT_CONTENT.brand, ...(r.brand ?? {}) },
    hero: { ...DEFAULT_CONTENT.hero, ...(r.hero ?? {}) },
    howItWorks: {
      steps: r.howItWorks?.steps?.length ? r.howItWorks.steps : DEFAULT_CONTENT.howItWorks.steps,
    },
    services: { ...DEFAULT_CONTENT.services, ...(r.services ?? {}) },
    team: { ...DEFAULT_CONTENT.team, ...(r.team ?? {}) },
    gallery: {
      ...DEFAULT_CONTENT.gallery,
      ...(r.gallery ?? {}),
      items: r.gallery?.items?.length ? r.gallery.items : DEFAULT_CONTENT.gallery.items,
    },
    whyUs: {
      ...DEFAULT_CONTENT.whyUs,
      ...(r.whyUs ?? {}),
      cards: r.whyUs?.cards?.length ? r.whyUs.cards : DEFAULT_CONTENT.whyUs.cards,
    },
    bookingIntro: {
      ...DEFAULT_CONTENT.bookingIntro,
      ...(r.bookingIntro ?? {}),
      bullets: r.bookingIntro?.bullets?.length ? r.bookingIntro.bullets : DEFAULT_CONTENT.bookingIntro.bullets,
    },
    faq: {
      ...DEFAULT_CONTENT.faq,
      ...(r.faq ?? {}),
      items: r.faq?.items?.length ? r.faq.items : DEFAULT_CONTENT.faq.items,
    },
    contact: { ...DEFAULT_CONTENT.contact, ...(r.contact ?? {}) },
  };
}

/**
 * Published content for the public-facing site. If the site_content table
 * doesn't exist yet (migration not run) or the row is missing, this
 * silently falls back to DEFAULT_CONTENT — the live site keeps working
 * exactly as before and never shows an error page.
 */
export async function getPublishedContent(): Promise<SiteContent> {
  try {
    const { data, error } = await supabase.from(TABLE).select("published").eq("id", CONTENT_ID).single();
    if (error || !data?.published) return DEFAULT_CONTENT;
    return normalize(data.published);
  } catch {
    return DEFAULT_CONTENT;
  }
}

export async function getDraftContent(): Promise<SiteContent> {
  try {
    const { data, error } = await supabase.from(TABLE).select("draft, published").eq("id", CONTENT_ID).single();
    if (error || (!data?.draft && !data?.published)) return DEFAULT_CONTENT;
    return normalize(data.draft ?? data.published);
  } catch {
    return DEFAULT_CONTENT;
  }
}

export async function saveDraftContent(content: SiteContent): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert({ id: CONTENT_ID, draft: content, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function publishDraftContent(content: SiteContent): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: existing } = await supabase.from(TABLE).select("published").eq("id", CONTENT_ID).single();

    const { error } = await supabase.from(TABLE).upsert(
      {
        id: CONTENT_ID,
        draft: content,
        published: content,
        previous: existing?.published ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function rollbackToPrevious(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from(TABLE)
      .select("previous")
      .eq("id", CONTENT_ID)
      .single();
    if (fetchError || !existing?.previous) {
      return { ok: false, error: "No previous version to roll back to." };
    }
    const { error } = await supabase
      .from(TABLE)
      .update({ draft: existing.previous, published: existing.previous, updated_at: new Date().toISOString() })
      .eq("id", CONTENT_ID);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
