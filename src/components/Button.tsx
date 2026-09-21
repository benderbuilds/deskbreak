"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

/**
 * Three levels only.
 *
 * primary: solid pen blue on an ink lip that the press collapses. One per view.
 * secondary: neutral filled. "ghost" and "mint" are kept as aliases so older
 * call sites keep compiling; both render as secondary.
 * tertiary: text.
 * field / fieldQuiet: primary and secondary on the pen-blue workout field.
 */
type Variant = "primary" | "secondary" | "tertiary" | "ghost" | "mint" | "ink" | "field" | "fieldQuiet";
type Size = "md" | "sm";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  children: ReactNode;
};

const variants: Record<Variant, string> = {
  primary:
    "bg-pen text-white shadow-[0_4px_0_var(--pen-deep)] hover:bg-[#1d30d6] active:translate-y-[3px] active:shadow-[0_1px_0_var(--pen-deep)]",
  ink: "bg-ink text-paper shadow-[0_4px_0_#000] hover:bg-ink/90 active:translate-y-[3px] active:shadow-[0_1px_0_#000]",
  secondary:
    "bg-sheet text-ink border border-line-strong shadow-[0_3px_0_var(--line-strong)] hover:bg-paper active:translate-y-[2px] active:shadow-[0_1px_0_var(--line-strong)]",
  ghost:
    "bg-sheet text-ink border border-line-strong shadow-[0_3px_0_var(--line-strong)] hover:bg-paper active:translate-y-[2px] active:shadow-[0_1px_0_var(--line-strong)]",
  mint:
    "bg-sheet text-ink border border-line-strong shadow-[0_3px_0_var(--line-strong)] hover:bg-paper active:translate-y-[2px] active:shadow-[0_1px_0_var(--line-strong)]",
  tertiary: "bg-transparent text-ink underline-offset-4 hover:underline",
  // On the pen-blue workout field.
  field:
    "bg-white text-pen-deep shadow-[0_4px_0_rgba(8,12,60,0.55)] hover:bg-paper active:translate-y-[3px] active:shadow-[0_1px_0_rgba(8,12,60,0.55)]",
  fieldQuiet:
    "bg-white/10 text-white border border-white/70 hover:bg-white/20 active:translate-y-[2px]",
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
    "transition-[background-color,transform,box-shadow,opacity] duration-100 ease-out",
    "disabled:opacity-45 disabled:shadow-none disabled:pointer-events-none",
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
        active ? "border border-ink bg-ink text-paper" : "border border-line-strong bg-sheet text-ink hover:bg-paper",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
