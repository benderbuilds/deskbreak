import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/LogoMark";
import { MOVEMENT_DISCLAIMER } from "@/lib/constants";

/**
 * Wrapper for the public, server-rendered pages.
 *
 * Deliberately separate from the app shell: nothing here reads local storage, so
 * `/` and the SEO pages stay static and fast for a first-time visitor.
 */
export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper">
      <header className="mx-auto flex w-full max-w-[64rem] items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2" aria-label="DeskBreak home">
          <LogoMark size={34} />
          <span className="font-display text-lg font-semibold tracking-tight">
            DeskBreak
          </span>
        </Link>
        <Link
          href="/app/start"
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper transition-transform duration-200 active:scale-95"
        >
          Start a reset
        </Link>
      </header>

      <main className="mx-auto w-full max-w-[64rem] px-5 pb-20">{children}</main>

      <footer className="border-t border-ink/8">
        <div className="mx-auto w-full max-w-[64rem] px-5 py-8 text-sm text-ink/55">
          <p className="max-w-[42rem] leading-relaxed">{MOVEMENT_DISCLAIMER}</p>
          <nav className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-semibold">
            <Link href="/desk-exercises" className="hover:text-ink">
              Desk exercises
            </Link>
            <Link href="/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-ink">
              Terms
            </Link>
            <Link href="/support" className="hover:text-ink">
              Support
            </Link>
          </nav>
          <p className="mt-5 text-xs text-ink/40">
            &copy; {new Date().getFullYear()} DeskBreak
          </p>
        </div>
      </footer>
    </div>
  );
}
