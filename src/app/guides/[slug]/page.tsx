import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { LandingViewTracker, StartResetButton } from "@/components/marketing/LandingCta";
import { RichText } from "@/components/marketing/RichText";
import { GUIDE_PAGES, findGuidePage, startRoutineName } from "@/lib/seo-content";

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDE_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
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

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = findGuidePage(slug);
  if (!page) notFound();
  const routine = startRoutineName(page.need, page.minutes);

  return (
    <MarketingShell>
      <LandingViewTracker page={`guide_${page.slug}`} seo />
      <article className="py-10">
        <h1 className="font-display font-extrabold text-[2.2rem] leading-tight text-ink">{page.title}</h1>
        <p className="mt-4 max-w-[42rem] text-lg leading-relaxed text-muted">{page.intro}</p>

        <div className="mt-8 max-w-[42rem] space-y-7">
          {page.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display font-extrabold text-xl text-ink">{section.heading}</h2>
              <p className="mt-2 leading-relaxed text-ink/70">
                <RichText text={section.body} />
              </p>
            </section>
          ))}
        </div>

        <div className="surface-elevated mt-10 max-w-[34rem] px-5 py-6 sm:px-7">
          <p className="font-display font-extrabold text-lg text-ink">Try the guided {routine}</p>
          <p className="mt-1 text-sm text-muted">Timed, cued and illustrated. No account, no equipment.</p>
          <div className="mt-4">
            <StartResetButton need={page.need} minutes={page.minutes} source={`guide_${page.slug}`} seo>
              {`Start the ${routine}`}
            </StartResetButton>
          </div>
        </div>
      </article>
    </MarketingShell>
  );
}
