"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost" | "mint";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  block?: boolean;
  children: ReactNode;
};

const variants: Record<Variant, string> = {
  primary:
    "bg-coral text-white shadow-[0_5px_0_#E04420] active:shadow-none active:translate-y-[5px]",
  secondary:
    "bg-ink text-paper shadow-[0_5px_0_#0C0A09] active:shadow-none active:translate-y-[5px]",
  ghost:
    "bg-transparent text-ink border-2 border-ink/12 active:bg-ink/5",
  mint:
    "bg-mint text-ink shadow-[0_5px_0_#1BAF8A] active:shadow-none active:translate-y-[5px]",
};

export function buttonClassName(
  variant: Variant = "primary",
  block = true,
  className = "",
) {
  return [
    "inline-flex items-center justify-center gap-2 rounded-[22px] px-5 min-h-14 text-base font-semibold tracking-tight",
    "transition-transform duration-200 ease-[cubic-bezier(0.34,1.4,0.64,1)]",
    "disabled:opacity-40 disabled:pointer-events-none",
    block ? "w-full" : "",
    variants[variant],
    className,
  ].join(" ");
}

export function Button({
  variant = "primary",
  block = true,
  className = "",
  children,
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={buttonClassName(variant, block, className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  block = true,
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  block?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClassName(variant, block, className)}>
      {children}
    </Link>
  );
}
