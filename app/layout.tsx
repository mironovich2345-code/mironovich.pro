import type { Metadata, Viewport } from "next";
import { Inter, Roboto_Condensed } from "next/font/google";
import Script from "next/script";
import Analytics from "@/components/Analytics";
import Footer from "@/components/Footer";
import SiteHeader from "@/components/SiteHeader";
import { site, siteUrl } from "@/config/site";
import { urlHygieneScript } from "@/lib/url-hygiene";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-inter",
});

// Editorial display face — oversized headlines only (font-display utility). Chosen over
// Inter 800 after a side-by-side check: condensed width reads closer to a magazine cover.
const displayFont = Roboto_Condensed({
  subsets: ["latin", "cyrillic"],
  weight: ["700", "800"],
  display: "swap",
  variable: "--font-display",
});

// Site-wide defaults only. Canonical, URL, title and description are set per page
// (lib/seo.ts) so error and utility pages never inherit the homepage's values.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: site.title,
    template: "%s — " + site.name,
  },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.person, url: siteUrl + "/about" }],
  openGraph: { siteName: site.name, locale: "ru_RU", type: "website" },
  twitter: { card: "summary_large_image" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0E0E11",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={inter.variable + " " + displayFont.variable}>
      <body className="font-sans antialiased">
        {/* strips personal data from the query string before analytics or attribution read it */}
        <Script id="url-hygiene" strategy="beforeInteractive">
          {urlHygieneScript}
        </Script>
        <a
          href="#main"
          className="sr-only z-[70] bg-signal px-4 py-3 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        >
          Перейти к содержанию
        </a>
        <SiteHeader />
        {children}
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
