"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

/**
 * Three levels only.
 *
 * primary: solid coral. One per view.
 * secondary: neutral filled. "ghost" and "mint" are kept as aliases so older
 * call sites keep compiling; both render as secondary.
 * tertiary: text.
 */
type Variant = "primary" | "secondary" | "tertiary" | "ghost" | "mint" | "ink";
type Size = "md" | "sm";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  children: ReactNode;
};

const variants: Record<Variant, string> = {
  primary:
    "bg-coral text-white hover:bg-coral-deep active:bg-coral-deep shadow-[0_1px_0_rgba(224,68,32,0.35)]",
  ink: "bg-ink text-paper hover:bg-ink/90",
  secondary: "bg-ink/6 text-ink hover:bg-ink/10 active:bg-ink/12",
  ghost: "bg-ink/6 text-ink hover:bg-ink/10 active:bg-ink/12",
  mint: "bg-ink/6 text-ink hover:bg-ink/10 active:bg-ink/12",
  tertiary: "bg-transparent text-ink/70 hover:text-ink hover:bg-ink/5",
};

const sizes: Record<Size, string> = {
  md: "min-h-13 px-5 text-base rounded-[16px]",
  sm: "min-h-11 px-4 text-sm rounded-[12px]",
};

export function buttonClassName(
  variant: Variant = "primary",
  block = true,
  className = "",
  size: Size = "md",
) {
  return [
    "inline-flex items-center justify-center gap-2 font-semibold tracking-tight",
    "transition-[background-color,transform,opacity] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-[0.985]",
    "disabled:opacity-40 disabled:pointer-events-none",
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
        active ? "bg-ink text-paper" : "bg-ink/6 text-ink/70 hover:bg-ink/10",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
