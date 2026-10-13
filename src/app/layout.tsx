import type { Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./motion.css";
import "./match-presentation.css";
const inter = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
});

const display = localFont({
  src: "../../node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2",
  variable: "--font-display",
  display: "swap",
  weight: "700",
});
export { brandMetadata as metadata } from "@/lib/brand";
export const viewport: Viewport = {
  themeColor: "#0b0f14",
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${display.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
          (() => {
            let appearance = null;
            try { appearance = localStorage.getItem('second-look-appearance'); } catch {}
            document.documentElement.dataset.theme =
              appearance === 'light' ? 'light' :
              appearance === 'system' && !matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark';
          })();
        `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
