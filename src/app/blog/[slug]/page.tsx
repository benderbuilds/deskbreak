import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { LandingViewTracker, StartResetButton } from "@/components/marketing/LandingCta";
import { PainNote, RichText } from "@/components/marketing/RichText";
import { BLOG_POSTS, blogCtaRoutine, blogWordCount, findBlogPost, type BlogBlock } from "@/content/blog";
import { getSource, shortCitation } from "@/lib/seo-content";

const BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://deskbreak.co").replace(/\/$/, "");

export const dynamicParams = false;

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = findBlogPost(slug);
  if (!post) return {};
  return {
    title: post.metaTitle,
    description: post.metaDescription,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.metaTitle,
      description: post.metaDescription,
      type: "article",
      publishedTime: post.published,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = findBlogPost(slug);
  if (!post) notFound();

  const sources = post.sources.map(getSource);
  const routine = blogCtaRoutine(post.cta);
  const minutesToRead = Math.max(1, Math.round(blogWordCount(post) / 230));
  const cta = "program" in post.cta ? { program: post.cta.program } : { need: post.cta.need, minutes: post.cta.minutes, setup: post.cta.setup };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.metaDescription,
    datePublished: post.published,
    url: `${BASE}/blog/${post.slug}`,
    author: { "@type": "Organization", name: "DeskBreak" },
    publisher: { "@type": "Organization", name: "DeskBreak", url: BASE },
    citation: sources.map((source) => ({ "@type": "ScholarlyArticle", name: source.title, url: source.url })),
  };

  return (
    <MarketingShell>
      <LandingViewTracker page={`blog_${post.slug}`} seo />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="py-10">
        <nav aria-label="Breadcrumb" className="text-sm font-semibold text-ink/50">
          <Link href="/blog" className="hover:text-ink">
            Blog
          </Link>
        </nav>
        <h1 className="mt-3 max-w-[42rem] font-display text-[2.1rem] font-semibold leading-tight tracking-tight text-ink sm:text-[2.5rem]">
          {post.title}
        </h1>
        <p className="mt-3 text-sm text-ink/50">
          <time dateTime={post.published}>{formatDate(post.published)}</time> · {minutesToRead} min read ·{" "}
          {sources.length} studies cited
        </p>

        {post.painNote ? <PainNote className="mt-6" /> : null}

        <div className="mt-8 max-w-[42rem] space-y-5 leading-relaxed text-ink/75">
          {post.blocks.map((block, index) => (
            <Block key={index} block={block} />
          ))}
        </div>

        <div className="surface-elevated mt-10 max-w-[34rem] px-5 py-6 sm:px-7">
          <p className="font-display text-lg font-semibold text-ink">Try the {routine}</p>
          <p className="mt-1 text-sm text-ink/60">{post.cta.body}</p>
          <div className="mt-4">
            <StartResetButton {...cta} source={`blog_${post.slug}`} seo>
              {`Start the ${routine}`}
            </StartResetButton>
          </div>
        </div>

        <section className="mt-12 max-w-[42rem]" aria-labelledby="references">
          <h2 id="references" className="font-display text-xl font-semibold text-ink">
            References
          </h2>
          <ol className="mt-4 grid gap-3 text-sm leading-relaxed text-ink/70">
            {sources.map((source) => (
              <li key={source.id} className="pl-8 -indent-8">
                {(source.citation ?? source.title).replace(source.url, "").trim()}{" "}
                <a href={source.url} target="_blank" rel="noreferrer" className="break-all font-semibold text-coral">
                  {source.url}
                </a>
              </li>
            ))}
          </ol>
          <aside className="mt-6 rounded-[16px] border border-ink/10 bg-white px-5 py-4 text-sm leading-relaxed text-ink/65">
            <p className="font-semibold text-ink/80">Sources and how we use them</p>
            <p className="mt-1">
              Every study cited here is checked against its PubMed record and DOI. Quotes are the authors&apos; own words
              from the published abstract, and we keep the limits each study states. Findings describe the research,
              not what DeskBreak will do for you. DeskBreak is general movement guidance, not medical care.{" "}
              <Link href="/science#how-we-use-sources" className="font-semibold text-coral">
                How DeskBreak uses research
              </Link>
            </p>
          </aside>
        </section>

        <nav className="mt-12 text-sm text-ink/55" aria-label="More posts">
          <p className="font-semibold text-ink/70">More from the blog</p>
          <ul className="mt-2 grid gap-2">
            {BLOG_POSTS.filter((entry) => entry.slug !== post.slug).map((entry) => (
              <li key={entry.slug}>
                <Link href={`/blog/${entry.slug}`} className="font-semibold text-coral">
                  {entry.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </article>
    </MarketingShell>
  );
}

function Block({ block }: { block: BlogBlock }) {
  switch (block.type) {
    case "h2":
      return <h2 className="pt-4 font-display text-xl font-semibold text-ink">{block.text}</h2>;
    case "list":
      return (
        <ul className="space-y-2">
          {block.items.map((item) => (
            <li key={item} className="ml-5 list-disc">
              <RichText text={item} />
            </li>
          ))}
        </ul>
      );
    case "quote": {
      const source = getSource(block.sourceId);
      return (
        <figure className="border-l-4 border-coral/60 pl-4">
          <blockquote className="text-ink/85">&ldquo;{source.quote}&rdquo;</blockquote>
          <figcaption className="mt-1.5 text-sm text-ink/50">
            <a href={source.url} target="_blank" rel="noreferrer" className="text-coral hover:underline">
              {shortCitation(source.id)}
            </a>
            {source.quoteLocation ? `, ${source.quoteLocation.split(" (")[0].toLowerCase()}` : null}
          </figcaption>
        </figure>
      );
    }
    default:
      return (
        <p>
          <RichText text={block.text} />
        </p>
      );
  }
}

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}
