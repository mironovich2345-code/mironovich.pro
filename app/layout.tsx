import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Analytics from "@/components/Analytics";
import Footer from "@/components/Footer";
import SiteHeader from "@/components/SiteHeader";
import { site, siteUrl } from "@/config/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: site.title,
    template: "%s — " + site.name,
  },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.name, url: siteUrl }],
  keywords: [
    "система обучения сотрудников", "обучение сотрудников", "адаптация сотрудников",
    "онбординг сотрудников", "корпоративная академия", "база знаний сотрудников",
    "аттестация сотрудников", "автоматизация обучения сотрудников",
  ],
  alternates: { canonical: siteUrl },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: siteUrl,
    siteName: site.name,
    title: site.title,
    description: site.description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: site.name + " — системы обучения сотрудников для бизнеса", type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: site.title,
    description: site.description,
    images: ["/og.png"],
  },
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#161826",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="font-sans antialiased">
        <SiteHeader />
        {children}
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
