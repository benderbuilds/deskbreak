import {
  BLOG_FIGURE_MOBILE_MAX_WIDTH,
  blogFigureSrc,
  type BlogFigureAsset,
} from "@/content/blog-figures";
import { getSource, shortCitation } from "@/lib/seo-content";

/**
 * A research figure inside a blog post.
 *
 * The image is never the only way to reach the finding. The caption and its
 * source links stay visible, the full text equivalent sits in an ordinary
 * disclosure, and a chart's numbers are also a real table. With images off,
 * the figure still explains itself.
 *
 * The two renditions are different compositions, not two sizes of one picture:
 * the mobile file is taller and reordered. That means each breakpoint reserves
 * its own aspect ratio, or the article jumps when the image loads.
 */
export function BlogFigure({ figure }: { figure: BlogFigureAsset }) {
  const { desktop, mobile } = figure.files;
  // One ratio per breakpoint. The id comes from a literal union, so it is safe
  // in a selector. Tailwind cannot express a per-figure ratio from manifest data.
  const ratioCss =
    `#${figure.id} .blog-figure-image{aspect-ratio:${desktop.width}/${desktop.height}}` +
    `@media (max-width:${BLOG_FIGURE_MOBILE_MAX_WIDTH - 0.02}px){` +
    `#${figure.id} .blog-figure-image{aspect-ratio:${mobile.width}/${mobile.height}}}`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ratioCss }} />
      <figure id={figure.id} className="scroll-mt-24 rounded-[16px] border border-line bg-white p-4 sm:p-5">
        <picture>
          <source media={`(max-width: ${BLOG_FIGURE_MOBILE_MAX_WIDTH - 0.02}px)`} srcSet={blogFigureSrc(mobile)} />
          {/* Art-directed <picture>: the breakpoints swap composition, not just
              resolution, so next/image cannot express this. */}
          <img
            className="blog-figure-image w-full rounded-[10px]"
            src={blogFigureSrc(desktop)}
            alt={figure.alt}
            width={desktop.width}
            height={desktop.height}
            loading="lazy"
            decoding="async"
          />
        </picture>

        <figcaption className="mt-3 text-sm leading-relaxed text-muted">
          <span className="text-ink/75">{figure.caption}</span>{" "}
          <span className="whitespace-nowrap">
            {figure.sourceIds.map((id, index) => (
              <span key={id}>
                {index > 0 ? "; " : null}
                <a
                  href={getSource(id).url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-pen underline underline-offset-2"
                >
                  {shortCitation(id)}
                </a>
              </span>
            ))}
          </span>

          <details className="mt-3 border-t border-line pt-3">
            <summary className="cursor-pointer font-semibold text-ink/80">Read figure details</summary>
            <div className="mt-2 grid gap-2">
              {figure.longDescription.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            {figure.dataTable ? <FigureTable table={figure.dataTable} /> : null}
          </details>
        </figcaption>
      </figure>
    </>
  );
}

function FigureTable({ table }: { table: NonNullable<BlogFigureAsset["dataTable"]> }) {
  return (
    <div className="mt-3">
      {/* The table can scroll on a narrow screen; the page must not. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-left">
          <caption className="pb-2 text-left font-semibold text-ink/80">{table.caption}</caption>
          <thead>
            <tr>
              {table.columns.map((column) => (
                <th key={column} scope="col" className="border-b border-line py-2 pr-3 align-bottom font-semibold text-ink/80">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={String(row[0])}>
                {row.map((cell, index) =>
                  index === 0 ? (
                    <th key={index} scope="row" className="border-b border-line py-2 pr-3 font-semibold text-ink/75">
                      {cell}
                    </th>
                  ) : (
                    <td key={index} className="border-b border-line py-2 pr-3 tabular-nums">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2">{table.note}</p>
    </div>
  );
}
