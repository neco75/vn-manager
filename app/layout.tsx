import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LibraryProvider } from "@/context/LibraryContext";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { ClientLayout } from "@/components/ClientLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vn-manager.vercel.app"),
  title: {
    default: "VN Manager - Visual Novel Collection",
    template: "%s | VN Manager",
  },
  description: "Manage your visual novel collection, track progress, and discover new games with VN Manager.",
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "/",
    siteName: "VN Manager",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <LibraryProvider>
          <ClientLayout>
            {children}
            <SpeedInsights />
          </ClientLayout>
        </LibraryProvider>
      </body>
    </html>
  );
}


