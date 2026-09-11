import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const SITE_URL = "https://proposal.truetel.com.au";
const OG_DESCRIPTION =
  "TrueTel's internal, mobile-first proposal engine — a complete, branded proposal drafted, priced, and ready to send before you leave the client meeting. Cloud Phone is live now; Managed IT and AI Voice Agent proposals are coming soon.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "TrueTel Proposal Builder",
  description: OG_DESCRIPTION,
  robots: { index: false, follow: false },
  openGraph: {
    title: "TrueTel Proposal Builder",
    description: OG_DESCRIPTION,
    url: SITE_URL,
    siteName: "TrueTel Solutions",
    type: "website",
    locale: "en_AU",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "TrueTel Proposal Builder" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TrueTel Proposal Builder",
    description: OG_DESCRIPTION,
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU" className={`${jakarta.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
