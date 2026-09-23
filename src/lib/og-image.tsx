import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";

/**
 * Social preview images, in the app's own look: the navy workout field with
 * the timer bar draining across it, the way a move looks while it runs.
 *
 * Every shared link gets one, so a post on Product Hunt or Reddit shows the
 * product rather than an empty grey box.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

// The workout field, not the action colour: white on cobalt is fine for a
// button but heavy across a 1200x630 card, and the field is what the product
// actually looks like while someone is moving.
const FIELD = "#18233D";
const FIELD_DRAINED = "#111C33";
const NOTE = "#FFE08A";

/**
 * Read from the source tree rather than a URL: the fonts ship with the build,
 * so an image never depends on a network call at request time.
 */
async function mark(): Promise<string> {
  const png = await readFile(new URL("../../public/icons/logo-mark.png", import.meta.url));
  return `data:image/png;base64,${png.toString("base64")}`;
}

async function fonts() {
  const [bold, medium] = await Promise.all([
    readFile(new URL("../app/og-fonts/Archivo-ExtraBold.ttf", import.meta.url)),
    readFile(new URL("../app/og-fonts/Archivo-Medium.ttf", import.meta.url)),
  ]);
  return [
    { name: "Archivo", data: bold, weight: 800 as const, style: "normal" as const },
    { name: "Archivo", data: medium, weight: 500 as const, style: "normal" as const },
  ];
}

/**
 * The renderer drops the space after a hyphenated run, so "20-20-20 rule"
 * comes out as "20-20-20rule". A non-breaking space survives it.
 */
function spaceAfterHyphens(title: string): string {
  return title.replace(/(\S*-\S*) /g, "$1\u00A0");
}

/** Longer headlines step down so they still fill the frame without wrapping past it. */
function titleSize(title: string): number {
  if (title.length > 95) return 54;
  if (title.length > 70) return 62;
  if (title.length > 45) return 74;
  return 88;
}

export async function ogImage({
  title,
  kicker,
  footnote,
  progress = 0.62,
}: {
  title: string;
  /** Small line above the headline: what kind of page this is. */
  kicker?: string;
  /** Small line along the bottom: a citation, a routine, a promise. */
  footnote?: string;
  /** How far the timer bar has drained, 0 to 1. */
  progress?: number;
}) {
  const [logo, typefaces] = await Promise.all([mark(), fonts()]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: FIELD,
          padding: "64px 72px",
          fontFamily: "Archivo",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={52} height={52} alt="" style={{ borderRadius: 14 }} />
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.5 }}>DeskBreak</div>
          {kicker ? (
            <div style={{ fontSize: 24, fontWeight: 500, color: "rgba(255,255,255,0.75)" }}>
              {kicker}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: titleSize(title),
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -1.5,
            maxWidth: 1000,
          }}
        >
          {spaceAfterHyphens(title)}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {footnote ? (
            <div style={{ display: "flex", fontSize: 26, fontWeight: 500, color: NOTE }}>
              {footnote}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              width: "100%",
              height: 14,
              borderRadius: 999,
              backgroundColor: FIELD_DRAINED,
            }}
          >
            <div
              style={{
                width: `${Math.round(Math.min(Math.max(progress, 0), 1) * 100)}%`,
                height: "100%",
                borderRadius: 999,
                backgroundColor: NOTE,
              }}
            />
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: typefaces },
  );
}
