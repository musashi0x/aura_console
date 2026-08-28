import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Aura Console",
  description: "Aura Console monorepo health",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Keyboard users must be able to reach content without tabbing the shell. */}
        {/* Decorative operator canvas. Hidden from assistive technology and
            never focusable, because it carries no information. */}
        <div className="backdrop" aria-hidden="true" />
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
