import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { LandingViewTracker, StartResetButton } from "@/components/marketing/LandingCta";
import { GUIDE_PAGES, findGuidePage } from "@/lib/seo-content";

export function generateStaticParams() {
  return GUIDE_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = findGuidePage(slug);
  if (!page) return {};
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: `/guides/${page.slug}` },
    openGraph: { title: page.metaTitle, description: page.metaDescription },
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = findGuidePage(slug);
  if (!page) notFound();

  return (
    <MarketingShell>
      <LandingViewTracker page={`guide_${page.slug}`} />
      <article className="py-10">
        <h1 className="font-display text-[2.2rem] font-semibold leading-tight tracking-tight text-ink">
          {page.title}
        </h1>
        <p className="mt-4 max-w-[42rem] text-lg leading-relaxed text-ink/65">
          {page.intro}
        </p>

        <div className="mt-8 max-w-[42rem] space-y-7">
          {page.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-xl font-semibold text-ink">
                {section.heading}
              </h2>
              <p className="mt-2 leading-relaxed text-ink/70">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-[26px] bg-white px-5 py-6 shadow-[0_4px_0_rgba(28,25,23,0.06)] sm:px-7">
          <p className="font-display text-lg font-semibold text-ink">
            {page.ctaLabel}
          </p>
          <p className="mt-1 text-sm text-ink/60">
            Timed, cued and illustrated. No account, no equipment.
          </p>
          <div className="mt-4">
            <StartResetButton need={page.need} source={`guide_${page.slug}`}>
              Start the 2-minute reset
            </StartResetButton>
          </div>
        </div>
      </article>
    </MarketingShell>
  );
}
