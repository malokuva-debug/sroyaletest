"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, Languages, LogOut, RotateCcw, Save, UploadCloud } from "lucide-react";
import type { SiteContent } from "@/lib/blocks/types";
import type { Language } from "@/lib/translations";
import LandingPageView from "@/components/landing-page-view";

type Status = { kind: "idle" | "saving" | "saved" | "publishing" | "published" | "error"; message?: string };

export default function EditorPage() {
  const [content, setContent] = useState<SiteContent | null>(null);
  const [lang, setLang] = useState<Language>("sq");
  const [showBoth, setShowBoth] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch("/api/admin/content")
      .then((r) => r.json())
      .then((json) => setContent(json.content))
      .catch(() => setStatus({ kind: "error", message: "Could not load content." }));
  }, []);

  const updateContent = (next: SiteContent) => {
    setContent(next);
    setDirty(true);
  };

  const saveDraft = async () => {
    if (!content) return;
    setStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Save failed");
      setDirty(false);
      setStatus({ kind: "saved" });
      setTimeout(() => setStatus({ kind: "idle" }), 2000);
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Save failed" });
    }
  };

  const publish = async () => {
    if (!content) return;
    if (!window.confirm("Publish these changes to the live site now?")) return;
    setStatus({ kind: "publishing" });
    try {
      const res = await fetch("/api/admin/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Publish failed");
      setDirty(false);
      setStatus({ kind: "published" });
      setTimeout(() => setStatus({ kind: "idle" }), 2500);
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Publish failed" });
    }
  };

  const rollback = async () => {
    if (!window.confirm("Roll the LIVE site back to the previously published version? This can't be undone.")) return;
    try {
      const res = await fetch("/api/admin/rollback", { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Rollback failed");
      const refreshed = await fetch("/api/admin/content").then((r) => r.json());
      setContent(refreshed.content);
      setDirty(false);
      setStatus({ kind: "saved", message: "Rolled back." });
      setTimeout(() => setStatus({ kind: "idle" }), 2000);
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Rollback failed" });
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/editor/login";
  };

  if (!content) {
    return (
      <main className="grid min-h-screen place-items-center bg-brand-950">
        <p className="text-white/60">Loading editor…</p>
      </main>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      {/* Top bar */}
      <header className="relative z-30 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-800">
            <ArrowLeft size={14} /> Site
          </Link>
          <p className="text-[15px] font-bold text-brand-800">Editor</p>
          {dirty && <span className="rounded-full bg-gold-100 px-2.5 py-0.5 text-[11px] font-medium text-gold-700">Unsaved changes</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {status.kind === "error" && <span className="mr-1 text-[12px] text-red-600">{status.message}</span>}
          {status.kind === "saved" && <span className="mr-1 text-[12px] text-emerald-600">{status.message ?? "Draft saved"}</span>}
          {status.kind === "published" && <span className="mr-1 text-[12px] text-emerald-600">Published!</span>}

          {/* Language toggle — controls which language you're editing/previewing live */}
          <div className="flex items-center gap-0.5 rounded-full border border-slate-200 p-0.5">
            {(["sq", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`rounded-full px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-wide transition-colors ${
                  lang === l ? "bg-brand-800 text-white" : "text-slate-500 hover:text-brand-700"
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowBoth((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              showBoth ? "border-gold-400 bg-gold-50 text-gold-700" : "border-slate-200 text-slate-500 hover:text-slate-800"
            }`}
            title="Show the other language's text under each field so you can edit both at once"
          >
            <Languages size={13} /> Show both languages
          </button>

          <a
            href="/?preview=1"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:border-gold-400 hover:text-gold-700"
            title="Open the real, fully responsive page in a new tab"
          >
            <Eye size={13} /> Responsive preview
          </a>
          <button
            onClick={saveDraft}
            disabled={status.kind === "saving"}
            className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-700 hover:border-slate-400 disabled:opacity-50"
          >
            <Save size={13} /> {status.kind === "saving" ? "Saving…" : "Save draft"}
          </button>
          <button
            onClick={publish}
            disabled={status.kind === "publishing"}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-700 to-brand-600 px-3.5 py-1.5 text-[12px] font-semibold text-white hover:from-brand-600 hover:to-brand-500 disabled:opacity-50"
          >
            <UploadCloud size={13} /> {status.kind === "publishing" ? "Publishing…" : "Publish"}
          </button>
          <button
            onClick={rollback}
            className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1.5 text-[12px] text-slate-500 hover:border-red-300 hover:text-red-600"
            title="Roll live site back to the previous published version"
          >
            <RotateCcw size={13} />
          </button>
          <button onClick={logout} className="rounded-full border border-slate-200 p-1.5 text-slate-500 hover:text-slate-800" aria-label="Log out">
            <LogOut size={13} />
          </button>
        </div>
      </header>

      {/* Canvas: the real, live site. Click any text to type directly into
          it, click an image to swap it, use +/× to manage lists. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <LandingPageView content={content} onContentChange={updateContent} editable showBoth={showBoth} lang={lang} onLangChange={setLang} />
      </div>
    </div>
  );
}
