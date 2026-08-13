"use client";

import type { ElementType } from "react";
import type { Bi } from "@/lib/blocks/types";
import { EditableText } from "@/components/editor/inline/editable-text";

/**
 * Renders `value[lang]` exactly like plain text when not editing (so the
 * public site is byte-identical to before). In the editor it becomes
 * directly editable in place, and when "show both languages" is on, a
 * smaller secondary field for the other language appears immediately
 * beneath it — so you can edit both without leaving the live page.
 */
export function BiText({
  value,
  lang,
  editable,
  showBoth,
  onChange,
  as = "span",
  className = "",
  multiline = false,
}: {
  value: Bi;
  lang: "sq" | "en";
  editable?: boolean;
  showBoth?: boolean;
  onChange?: (next: Bi) => void;
  as?: ElementType;
  className?: string;
  multiline?: boolean;
}) {
  if (!editable) return <>{value[lang]}</>;

  const other = lang === "sq" ? "en" : "sq";

  return (
    <span data-bi-wrap="true" className="inline-block align-baseline">
      <EditableText
        as={as}
        className={className}
        multiline={multiline}
        value={value[lang]}
        onChange={(v) => onChange?.({ ...value, [lang]: v })}
      />
      {showBoth && (
        <EditableText
          as="span"
          multiline={multiline}
          value={value[other]}
          onChange={(v) => onChange?.({ ...value, [other]: v })}
          placeholder={other === "sq" ? "Shqip…" : "English…"}
          className="mt-0.5 block border-t border-dashed border-current/20 pt-0.5 text-[0.78em] italic opacity-60"
        />
      )}
    </span>
  );
}
