import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "hoodfrenzy — launch coins on Robinhood with up to 2× leverage";
const description =
  "The launchpad where a coin can rent senior credit and trade at 2x ETH beta. Fixed 1B supply, bonding-curve price discovery, and a raise that graduates into its own AMM. Built on Robinhood Chain.";

/**
 * Absolute URLs for OG/Twitter cards. Set NEXT_PUBLIC_SITE_URL to the real
 * domain in production; VERCEL_URL covers preview deployments automatically.
 */
function siteUrl(): URL {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL);
  }
  if (process.env.VERCEL_URL) {
    return new URL(`https://${process.env.VERCEL_URL}`);
  }
  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title,
  description,
  applicationName: "hoodfrenzy",
  openGraph: {
    type: "website",
    siteName: "hoodfrenzy",
    title,
    description,
    url: "/",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
