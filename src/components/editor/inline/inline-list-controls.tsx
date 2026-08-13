"use client";

import { Plus, X } from "lucide-react";

export function InlineRemoveButton({ onRemove, label = "Remove" }: { onRemove: () => void; label?: string }) {
  return (
    <button
      type="button"
      data-editor-ui="true"
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      aria-label={label}
      className="absolute right-1.5 top-1.5 z-20 grid h-6 w-6 place-items-center rounded-full bg-brand-950/90 text-white/70 opacity-0 shadow-lg transition-opacity hover:text-red-300 group-hover/item:opacity-100"
    >
      <X size={13} />
    </button>
  );
}

export function InlineAddTile({
  onAdd,
  label = "Add",
  className = "",
}: {
  onAdd: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-editor-ui="true"
      data-editable="true"
      onClick={(e) => {
        e.stopPropagation();
        onAdd();
      }}
      className={`flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 text-[13px] font-medium text-slate-400 transition-colors hover:border-gold-500 hover:text-gold-700 ${className}`}
    >
      <Plus size={15} /> {label}
    </button>
  );
}
