import type { Metadata } from "next";
import { brandAsset } from "./brand-assets";

const title = "Between the Lines | More than the score.";
const description =
  "See the pattern. Follow the play. Explore football insights, inspect the evidence, and replay the moments behind the score in an interactive synthetic match demo.";

// Existing deployment, not a new brand domain. Operators can override per host.
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.APP_URL ||
  "https://second-look.sybgm6dkhk.workers.dev";

export const brandMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Between the Lines",
  title: { default: title, template: "%s | Between the Lines" },
  description,
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "BTL",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: brandAsset("/favicon.ico"), sizes: "16x16 32x32 48x48" },
      { url: brandAsset("/favicon.svg"), type: "image/svg+xml", sizes: "any" },
      ...[16, 32, 48].map((size) => ({
        url: brandAsset(`/favicon-${size}x${size}.png`),
        sizes: `${size}x${size}`,
        type: "image/png",
      })),
    ],
    other: [
      {
        rel: "mask-icon",
        url: brandAsset("/safari-pinned-tab.svg"),
        color: "#15803d",
      },
    ],
    apple: [
      {
        url: brandAsset("/apple-touch-icon.png"),
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Between the Lines",
    url: "/",
    title,
    description,
    images: [
      {
        url: brandAsset("/opengraph-image.png"),
        type: "image/png",
        width: 1200,
        height: 630,
        alt: "Between the Lines — More than the score. Football explained. Evidence included. A glowing football pitch shows a passing route and a verification symbol.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [
      {
        url: brandAsset("/twitter-image.png"),
        alt: "Between the Lines — More than the score. Football explained. Evidence included. A glowing football pitch shows a passing route and a verification symbol.",
      },
    ],
  },
};
