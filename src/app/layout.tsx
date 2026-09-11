import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Script from "next/script";
import { Fraunces, Inter } from "next/font/google";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { INSTALL_CAPTURE_SCRIPT } from "@/lib/pwa-install";
import { PRODUCT_PROMISE, PRODUCT_SUBHEAD } from "@/lib/constants";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://deskbreak.app"),
  title: {
    default: `DeskBreak. ${PRODUCT_PROMISE}`,
    template: "%s | DeskBreak",
  },
  description: PRODUCT_SUBHEAD,
  applicationName: "DeskBreak",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "DeskBreak", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
  openGraph: {
    title: `DeskBreak. ${PRODUCT_PROMISE}`,
    description: PRODUCT_SUBHEAD,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#FF5A36",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-paper font-sans text-ink">
        <Script id="deskbreak-pwa-install" strategy="beforeInteractive">
          {INSTALL_CAPTURE_SCRIPT}
        </Script>
        {children}
        <Suspense fallback={null}>
          <AnalyticsProvider />
        </Suspense>
      </body>
    </html>
  );
}
