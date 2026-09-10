import type { ReactNode } from "react";

/** Shared typography for the long-form public pages. */
export function Prose({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <article className="py-10">
      <h1 className="font-display text-[2.2rem] font-semibold leading-tight tracking-tight text-ink">
        {title}
      </h1>
      {intro ? (
        <p className="mt-4 max-w-[42rem] text-lg leading-relaxed text-ink/65">{intro}</p>
      ) : null}
      <div className="mt-8 max-w-[42rem] space-y-6 leading-relaxed text-ink/70 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </article>
  );
}
