"use client";

import { useEffect, useRef, createElement, type KeyboardEvent, type ElementType } from "react";

/**
 * A contentEditable element bound to a single string field. Edits happen
 * exactly where the text lives on the canvas — no side panel, no separate
 * preview. `data-editable="true"` tells the canvas's click-capture logic to
 * let clicks reach this element instead of treating them as navigation.
 */
export function EditableText({
  value,
  onChange,
  as = "span",
  className = "",
  multiline = false,
  placeholder = "Click to edit…",
}: {
  value: string;
  onChange: (v: string) => void;
  as?: ElementType;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.textContent !== value) el.textContent = value;
  }, [value]);

  const handleInput = (e: React.FormEvent<HTMLElement>) => {
    onChange(e.currentTarget.textContent ?? "");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!multiline && e.key === "Enter") {
      e.preventDefault();
      (e.currentTarget as HTMLElement).blur();
    }
    e.stopPropagation();
  };

  return createElement(as, {
    ref,
    contentEditable: true,
    suppressContentEditableWarning: true,
    "data-editable": "true",
    "data-placeholder": placeholder,
    onInput: handleInput,
    onKeyDown: handleKeyDown,
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    className: `editable-field outline-none rounded-[3px] transition-[box-shadow] duration-150 cursor-text hover:ring-1 hover:ring-gold-500/60 focus:ring-2 focus:ring-gold-500 focus:bg-gold-100/30 ${className}`,
  });
}
