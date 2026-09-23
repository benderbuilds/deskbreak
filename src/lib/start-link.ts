/**
 * The /app/start link a public page hands to the product.
 *
 * Kept out of the client components that use it so a server-rendered page can
 * build the same link: the crawlable CTA and the phone start bar have to
 * agree, and this is the one place that decides what they say.
 */
export function startHref({
  need,
  minutes,
  setup,
  program,
  seo = false,
}: {
  need?: string;
  minutes?: number;
  setup?: "seated" | "standing";
  /** A specific authored routine, e.g. the walk break. */
  program?: string;
  seo?: boolean;
}): string {
  const params = new URLSearchParams();
  if (program) params.set("program", program);
  if (need) params.set("need", need);
  if (minutes) params.set("minutes", String(minutes));
  if (setup) params.set("setup", setup);
  params.set("source", seo ? "seo" : "landing");
  return `/app/start?${params.toString()}`;
}
