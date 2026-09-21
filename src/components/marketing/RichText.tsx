import Link from "next/link";
import type { ReactNode } from "react";
import { PAIN_NOTE, getSource, shortCitation } from "@/lib/seo-content";

const TOKEN = /\{cite:([a-z0-9,-]+)\}|\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * Renders body copy from seo-content and the blog.
 *
 * Two bits of markup: `{cite:id}` (or `{cite:a,b}`) becomes an inline
 * "(Author et al., Year)" citation linking the DOI, and `[text](href)` becomes
 * a link. An unknown source id throws at build time.
 */
export function RichText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    if (match[1]) {
      parts.push(<Citation key={index} ids={match[1].split(",")} />);
    } else {
      const href = match[3];
      parts.push(
        href.startsWith("/") ? (
          <Link key={index} href={href} className="font-semibold text-pen underline underline-offset-2 hover:decoration-2">
            {match[2]}
          </Link>
        ) : (
          <a key={index} href={href} target="_blank" rel="noreferrer" className="font-semibold text-pen underline underline-offset-2 hover:decoration-2">
            {match[2]}
          </a>
        ),
      );
    }
    last = index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

export function Citation({ ids }: { ids: string[] }) {
  return (
    <span>
      (
      {ids.map((id, i) => {
        const source = getSource(id);
        return (
          <span key={id}>
            {i > 0 ? "; " : null}
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              title={source.title}
              className="text-pen underline underline-offset-2 hover:decoration-2"
            >
              {shortCitation(id)}
            </a>
          </span>
        );
      })}
      )
    </span>
  );
}

/** The visible box on pages written for pain searches. */
export function PainNote({ className = "" }: { className?: string }) {
  return (
    <aside
      aria-labelledby="pain-note-heading"
      className={`max-w-[42rem] rounded-[16px] border border-line bg-white px-5 py-4 ${className}`}
    >
      <h2 id="pain-note-heading" className="font-display font-extrabold text-base text-ink">
        If you have pain…
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-ink/70">{PAIN_NOTE}</p>
    </aside>
  );
}
