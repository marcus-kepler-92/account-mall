import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/app/components/theme-provider";
import { SiteNameProvider } from "@/app/components/site-name-provider";
import { Analytics } from "@vercel/analytics/next";
import { config } from "@/lib/config";
import { KEYWORDS_META } from "@/lib/seo-keywords";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const siteTitle = config.siteName;
const siteDescription = config.siteDescription;
const siteKeywords = config.siteKeywords ?? KEYWORDS_META;
const siteUrl = config.siteUrl;

export const metadata: Metadata = {
  title: {
    default: siteTitle,
    template: `%s | ${siteTitle}`,
  },
  description: siteDescription,
  keywords: siteKeywords
    ? siteKeywords.split(/[,，]/).map((k) => k.trim()).filter(Boolean)
    : undefined,
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: siteTitle,
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const webSiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteTitle,
    url: siteUrl,
    description: siteDescription,
  }

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SiteNameProvider
            siteName={config.siteName}
            siteDescription={config.siteDescription}
            siteTagline={config.siteTagline}
            siteSubtitle={config.siteSubtitle}
            adminPanelLabel={config.adminPanelLabel}
          >
            {children}
            <Toaster />
            <Analytics />
          </SiteNameProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
