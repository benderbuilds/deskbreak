"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

/**
 * Three levels only.
 *
 * primary: solid cobalt. A press darkens it rather than dropping it onto a
 * pedestal. One per view.
 * secondary: white with a real edge. "ghost" and "mint" are kept as aliases
 * so older call sites keep compiling; both render as secondary.
 * tertiary: text.
 * field / fieldQuiet: primary and secondary on the navy workout field.
 */
type Variant = "primary" | "secondary" | "tertiary" | "ghost" | "mint" | "ink" | "field" | "fieldQuiet";
type Size = "md" | "sm";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  children: ReactNode;
};

const SECONDARY = "bg-sheet text-ink border border-line-strong hover:bg-accent-soft active:bg-accent-soft";

const variants: Record<Variant, string> = {
  primary: "bg-pen text-white hover:bg-pen-hover active:bg-pen-deep",
  ink: "bg-ink text-paper hover:bg-ink/90 active:bg-ink/80",
  secondary: SECONDARY,
  ghost: SECONDARY,
  mint: SECONDARY,
  tertiary: "bg-transparent text-ink underline-offset-4 hover:underline",
  // On the navy workout field, where cobalt does not have the contrast.
  field: "bg-white text-ink hover:bg-accent-soft active:bg-accent-soft",
  fieldQuiet: "bg-white/10 text-white border border-white/70 hover:bg-white/20 active:bg-white/25",
};

const sizes: Record<Size, string> = {
  md: "min-h-13 px-5 text-base rounded-[14px]",
  sm: "min-h-11 px-4 text-sm rounded-[12px]",
};

export function buttonClassName(
  variant: Variant = "primary",
  block = true,
  className = "",
  size: Size = "md",
) {
  return [
    "inline-flex items-center justify-center gap-2 font-semibold",
    "transition-[background-color,opacity] duration-100 ease-out",
    "disabled:opacity-45 disabled:pointer-events-none",
    block ? "w-full" : "",
    sizes[size],
    variants[variant],
    className,
  ].join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  block = true,
  className = "",
  children,
  type = "button",
  ...rest
}: Props) {
  return (
    <button type={type} className={buttonClassName(variant, block, className, size)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  block = true,
  className = "",
  children,
  prefetch,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  className?: string;
  children: ReactNode;
  prefetch?: boolean;
}) {
  return (
    <Link href={href} prefetch={prefetch} className={buttonClassName(variant, block, className, size)}>
      {children}
    </Link>
  );
}

/** A small pill toggle: chips on Today, Explore filters, settings choices. */
export function Chip({
  label,
  active,
  onClick,
  disabled,
  ariaLabel,
}: {
  label: ReactNode;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors duration-200",
        "disabled:opacity-40",
        active ? "border border-ink bg-ink text-paper" : "border border-line-strong bg-sheet text-ink hover:bg-accent-soft",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
