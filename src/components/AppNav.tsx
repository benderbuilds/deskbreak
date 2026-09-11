"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/LogoMark";

const items = [
  { href: "/app", label: "Today", icon: TodayIcon },
  { href: "/app/explore", label: "Explore", icon: ExploreIcon },
  { href: "/app/progress", label: "Progress", icon: ProgressIcon },
  { href: "/app/you", label: "You", icon: YouIcon },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname.startsWith(href);
}

/** Mobile: a bottom bar. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky bottom-0 z-20 mt-auto border-t border-ink/8 bg-paper/92 backdrop-blur-md lg:hidden"
      aria-label="Primary"
    >
      <ul className="mx-auto grid max-w-[520px] grid-cols-4 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold tracking-wide",
                  "transition-colors duration-200",
                  active ? "text-coral" : "text-ink/45",
                ].join(" ")}
              >
                <Icon active={active} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Desktop: a calm left rail. The user is sitting at the device this is for. */
export function SideNav() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky top-0 hidden h-dvh w-[220px] shrink-0 flex-col border-r border-ink/8 px-4 py-6 lg:flex"
      aria-label="Primary"
    >
      <Link href="/app" className="flex items-center gap-2 px-2" aria-label="DeskBreak Today">
        <LogoMark size={30} />
        <span className="font-display text-lg font-semibold tracking-tight">DeskBreak</span>
      </Link>
      <ul className="mt-8 grid gap-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex min-h-11 items-center gap-3 rounded-[12px] px-3 text-sm font-semibold transition-colors duration-200",
                  active ? "bg-ink/6 text-ink" : "text-ink/60 hover:bg-ink/4 hover:text-ink",
                ].join(" ")}
              >
                <Icon active={active} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto px-2 text-xs leading-relaxed text-ink/40">
        <Link href="/science" className="hover:text-ink">
          Why this works
        </Link>
      </div>
    </nav>
  );
}

function TodayIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} />
      <path d="M12 8v4l2.5 2" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" />
    </svg>
  );
}

function ExploreIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" />
    </svg>
  );
}

function ProgressIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 19V11m7 8V5m7 14v-6" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" />
    </svg>
  );
}

function YouIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} />
      <path d="M5 19c1.4-3.2 3.8-4.8 7-4.8S17.6 15.8 19 19" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" />
    </svg>
  );
}
