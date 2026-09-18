import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { LandingViewTracker } from "@/components/marketing/LandingCta";
import { BLOG_POSTS } from "@/content/blog";

export const metadata: Metadata = {
  title: "The DeskBreak blog: what the research says about desk breaks",
  description:
    "Plain-language reads on sitting, breaks, neck pain, eye strain and standing desks, with every study linked and its limits kept in.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndex() {
  return (
    <MarketingShell>
      <LandingViewTracker page="blog" seo />
      <section className="py-10">
        <h1 className="font-display text-[2.2rem] font-semibold leading-tight tracking-tight text-ink sm:text-[2.6rem]">
          What the research says
        </h1>
        <p className="mt-4 max-w-[42rem] text-lg leading-relaxed text-ink/65">
          Plain-language reads on sitting, breaks and desk bodies. Every study is linked, and we keep the limits each one
          states.{" "}
          <Link href="/science#how-we-use-sources" className="font-semibold text-coral">
            How we use sources
          </Link>
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {BLOG_POSTS.map((post) => (
            <li key={post.slug}>
              <Link href={`/blog/${post.slug}`} className="surface block h-full px-5 py-5 transition-colors hover:bg-ink/3">
                <span className="font-display text-lg font-semibold leading-snug text-ink">{post.title}</span>
                <span className="mt-2 block text-sm leading-relaxed text-ink/60">{post.metaDescription}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </MarketingShell>
  );
}
