'use client';

import { createUser, getUser } from "@/lib/actions";
import { useState } from 'react';
import { 
  Loader2, 
  Search, 
  XCircle, 
  UserPlus, 
  ArrowLeft 
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import Link from 'next/link';

function Logo({ size = 24, className = '' }) {
  const px = typeof size === 'number' ? `${size}px` : size;
  return (
    <img
      src="/royale-logo.png"
      alt="Sparta Royale"
      width={size} height={size}
      className={'inline-block object-contain select-none ' + className}
      style={{ width: px, height: px }}
      draggable={false}
    />
  );
}

async function sha256Hex(str) {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return str;
  const buf = new TextEncoder().encode(str);
  const hash = await window.crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleRegister() {
    if (!name.trim()) { toast.error('Vendosni emrin e plotë'); return; }
    if (!pw) { toast.error('Vendosni fjalëkalimin'); return; }
    if (pw !== pw2) { toast.error('Fjalëkalimet nuk përputhen'); return; }
    
    setBusy(true);
    try {
      const username = name.toLowerCase().replace(/\s+/g, '');
      const existing = await getUser(username);
      if (existing) {
        toast.error('Ky përdorues ekziston tashmë');
        setBusy(false);
        return;
      }

      const passwordHash = await sha256Hex(pw);
      await createUser({
        name,
        username,
        passwordHash,
        role: 'worker',
        status: 'pending',
      });
      
      toast.success('Regjistrimi u krye! Ju lutem prisni miratimin nga administratori.');
      // Redirect or clear form
      setName('');
      setPw('');
      setPw2('');
    } catch (e) {
      toast.error('Regjistrimi dështoi: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 p-4">
      <Toaster richColors position="top-center" />
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex w-24 h-24 rounded-3xl bg-black/20 items-center justify-center shadow-2xl ring-2 ring-gold-300/30 mb-4">
            <Logo size={64} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Sparta Royale</h1>
          <p className="text-xs uppercase tracking-widest text-gold-400 mt-1">Regjistrimi i Punëtorit</p>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-2xl ring-1 ring-white/10">
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard" className="text-white/60 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h2 className="text-lg font-semibold text-white">Regjistrohu</h2>
          </div>
          <p className="text-xs text-white/50 mb-5">
            Krijoni një llogari për të filluar punën.
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gold-300 block mb-1">Emri i plotë</label>
              <input
                className="w-full h-12 px-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400 text-base"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Filan Fisteku"
              />
            </div>
            
            <div>
              <label className="text-xs font-medium text-gold-300 block mb-1">Fjalëkalimi</label>
              <div className="relative">
                <input
                  className="w-full h-12 px-4 pr-11 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400 text-base"
                  type={showPw ? 'text' : 'password'}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                  onClick={() => setShowPw(s => !s)}
                >
                  {showPw ? <XCircle className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gold-300 block mb-1">Konfirmo fjalëkalimin</label>
              <input
                className="w-full h-12 px-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400 text-base"
                type={showPw ? 'text' : 'password'}
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRegister(); }}
                placeholder="••••••••"
              />
            </div>

            <button
              className="w-full h-12 rounded-xl font-bold text-base mt-1 flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-gold-500 to-gold-400 hover:from-gold-400 hover:to-gold-300 text-brand-900 disabled:opacity-60"
              onClick={handleRegister}
              disabled={busy}
            >
              {busy
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <UserPlus className="w-5 h-5" />}
              Regjistrohu
            </button>

            <div className="text-center pt-2">
              <Link href="/dashboard" className="text-[11px] text-white/60 hover:text-gold-400 transition-colors">
                Keni llogari? Identifikohuni këtu
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
