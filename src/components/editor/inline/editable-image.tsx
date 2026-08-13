"use client";

import { useState, useRef, useEffect } from "react";
import { ImagePlus } from "lucide-react";

export function EditableImage({
  src,
  alt,
  onChange,
  className = "",
  imgClassName = "",
  fill = false,
}: {
  src: string;
  alt: string;
  onChange: (v: string) => void;
  className?: string;
  imgClassName?: string;
  fill?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(src);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => setDraft(src), [src]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div
      ref={boxRef}
      data-editable="true"
      className={`group/img relative ${className}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={`${imgClassName} ${fill ? "absolute inset-0 h-full w-full" : ""}`} />

      <button
        type="button"
        data-editor-ui="true"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="absolute inset-0 z-10 grid place-items-center bg-black/0 opacity-0 transition-all group-hover/img:bg-black/45 group-hover/img:opacity-100"
        aria-label="Change image"
      >
        <span className="flex items-center gap-1.5 rounded-full bg-brand-950/95 px-3 py-1.5 text-[11.5px] font-medium text-white shadow-lg">
          <ImagePlus size={13} /> Change image
        </span>
      </button>

      {open && (
        <div
          data-editor-ui="true"
          onClick={(e) => e.stopPropagation()}
          className="absolute left-1/2 top-full z-30 mt-2 w-72 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl"
        >
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Image URL</p>
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onChange(draft);
                setOpen(false);
              }
            }}
            placeholder="/nailart.jpg or https://…"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[12.5px] text-slate-800 outline-none focus:border-gold-500"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-1.5 text-[12px] text-slate-400 hover:text-slate-700">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
              className="rounded-full bg-brand-800 px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-700"
            >
              Apply
            </button>
          </div>
          <p className="mt-2 text-[10.5px] leading-snug text-slate-400">
            Paste an image URL, or upload the file into your project&apos;s <code>/public</code>{" "}
            folder and reference it like <code>/new-photo.jpg</code>.
          </p>
        </div>
      )}
    </div>
  );
}
