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
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: config.siteName,
    description: config.siteDescription,
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
