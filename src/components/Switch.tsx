"use client";

import { useId, type ReactNode } from "react";

/**
 * A settings row with an on/off switch. The whole row is the control, so the
 * label is the name and the switch state is announced as checked or not.
 */
export function SwitchRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const hintId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={hint ? hintId : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-12 w-full items-center justify-between gap-4 py-2 text-left disabled:opacity-40"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {hint ? (
          <span id={hintId} className="mt-0.5 block text-xs leading-relaxed text-ink/55">
            {hint}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden
        className={[
          "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-ink" : "bg-ink/15",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-[1.375rem]" : "translate-x-0.5",
          ].join(" ")}
        />
      </span>
    </button>
  );
}
