"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function EditorLoginPage() {
  return (
    <Suspense fallback={null}>
      <EditorLoginForm />
    </Suspense>
  );
}

function EditorLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const unconfigured = params.get("unconfigured") === "1";
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Incorrect passcode.");
        setLoading(false);
        return;
      }
      router.push(params.get("next") ?? "/editor");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-brand-950 px-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-white/10 bg-brand-900 p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-gold-400">
          Sparta Royale · Site editor
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">Enter passcode</h1>

        {unconfigured && (
          <p className="mt-4 rounded-xl border border-gold-400/25 bg-gold-400/10 px-4 py-3 text-[12.5px] text-gold-300">
            No <code>EDITOR_PASSCODE</code> is set in your environment yet, so the editor is
            locked. Add it to your env vars and redeploy to enable editing.
          </p>
        )}

        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Passcode"
          autoFocus
          className="mt-6 w-full rounded-xl border border-white/10 bg-brand-950 px-4 py-3 text-white outline-none placeholder:text-white/40 focus:border-gold-400/50"
        />

        {error && <p className="mt-3 text-[13px] text-red-300">{error}</p>}

        <button
          type="submit"
          disabled={loading || unconfigured}
          className="mt-5 w-full rounded-xl bg-gradient-to-r from-gold-300 to-gold-400 px-5 py-3 text-sm font-bold text-brand-900 transition-all hover:from-gold-200 hover:to-gold-300 disabled:opacity-50"
        >
          {loading ? "Checking…" : "Enter editor"}
        </button>
      </form>
    </main>
  );
}
