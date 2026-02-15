import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/app/components/theme-provider";
import { SiteNameProvider } from "@/app/components/site-name-provider";
import { config } from "@/lib/config";
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

export async function generateMetadata(): Promise<Metadata> {
  const title = config.siteName;
  const description = config.siteDescription;
  const url = config.siteUrl;
  return {
    title,
    description,
    metadataBase: new URL(url),
    openGraph: {
      title,
      description,
      url,
      siteName: title,
      locale: "zh_CN",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
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
          </SiteNameProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
