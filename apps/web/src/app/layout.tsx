import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import type { ReactNode } from "react";

/* Astryx first, then this app's own stylesheet.
 *
 * Astryx keeps everything it ships inside cascade layers (reset →
 * astryx-base → astryx-theme) and its reset.css says so plainly: unlayered
 * consumer styles override all of them. globals.css is unlayered, so these
 * imports cannot take the console's own rules away from it.
 *
 * That is about the cascade only. The theme itself DOES change the console:
 * <Theme> in the console shell sets the typography and colour tokens, and the
 * console's type is Figtree from that point on. That is the adoption, not a
 * side effect. */
/* First, so the layer order below is established before any layer is used. */
import "@/styles/layers.css";

import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "@/themes/neutral/neutral.css";
import "@/themes/stone/stone.css";
import "generative-loaders/styles.css";

import "./globals.css";

/* The neutral theme asks for Figtree by CSS variable, so the font is loaded
   here and self-hosted by Next rather than fetched from a third party on
   first paint. `display: swap` keeps text readable while it arrives. */
const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aura Console",
  description: "Aura Console monorepo health",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={figtree.variable}>
      <body>
        {/* Decorative operator canvas. Hidden from assistive technology and
            never focusable, because it carries no information. */}
        <div className="backdrop" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
