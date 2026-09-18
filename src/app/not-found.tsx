import Link from "next/link";
import { ButtonLink } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";

const POPULAR_RESETS = [
  { label: "3-Minute Desk Reset", href: "/app/start?minutes=3&source=landing" },
  { label: "Neck + Shoulder Reset", href: "/app/start?need=neck_shoulders&minutes=3&source=landing" },
  { label: "Back + Hip Reset", href: "/app/start?need=back_hips&minutes=3&source=landing" },
];

/** A missing page is a dead end, not an error: offer the resets people start most. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper px-5 py-10">
      <div className="surface w-full max-w-[26rem] px-6 py-8 text-center">
        <div className="flex justify-center">
          <CharacterArt pose="idle" size={140} alt="Stretch" />
        </div>
        <h1 className="mt-4 font-display text-[1.6rem] font-semibold leading-tight text-ink">
          That page took a break
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink/60">
          It isn&apos;t here. You could take one too.
        </p>
        <ul className="mt-6 grid gap-2">
          {POPULAR_RESETS.map((reset) => (
            <li key={reset.href}>
              <Link
                href={reset.href}
                prefetch={false}
                className="flex min-h-12 items-center justify-center rounded-[14px] border border-ink/10 bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-ink/3"
              >
                {reset.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-5">
          <ButtonLink href="/" variant="secondary">
            Back home
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
