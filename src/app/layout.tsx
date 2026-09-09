import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { AppFrame } from "@/components/AppFrame";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DeskBreak — desk exercises while working",
  description:
    "One-tap office workouts and desk exercises for workers. A home workout routine for busy days, no equipment required.",
  applicationName: "DeskBreak",
  appleWebApp: {
    capable: true,
    title: "DeskBreak",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180" },
  },
};

export const viewport: Viewport = {
  themeColor: "#FF5A36",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-paper font-sans text-ink">
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
