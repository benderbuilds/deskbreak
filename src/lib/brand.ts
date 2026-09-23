/**
 * Brand artwork and the colours the platform is told about.
 *
 * The files keep their paths forever, so an old link or an installed icon
 * still resolves. What changes is the version on the end of the URL: the
 * service worker serves /icons/* from its cache before the network, and
 * browsers and operating systems hold favicons and installed icons for a long
 * time, so new bytes at an old URL are not enough.
 *
 * Bump ASSET_VERSION whenever the artwork changes, and change the service
 * worker's own VERSION in public/sw.js to match. It is a literal there
 * because that file is plain JavaScript served as-is.
 */
export const ASSET_VERSION = "cobalt-1";

/** The mark's square, and the page behind it. Match globals.css. */
export const BRAND_MARK_COLOR = "#3155D9";
export const BRAND_PAGE_COLOR = "#F7F9FC";

/** A public brand image URL, versioned so caches hand over the new artwork. */
export function brandAsset(path: string): string {
  return `${path}?v=${ASSET_VERSION}`;
}
