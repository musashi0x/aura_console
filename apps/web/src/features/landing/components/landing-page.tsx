"use client";

import { BlurInHeadline } from "@/components/blur-in-headline";
import { CounterfactualMatrix } from "@/components/counterfactual-matrix";
import { FAQ } from "@/components/faq";
import { FeaturesBento } from "@/components/features-bento";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { Pricing } from "@/components/pricing";
import { Providers } from "@/components/providers";
import { ThemeSwitch } from "@/components/theme-switch";
import { SkipLink } from "@/components/skip-link";
import Ravine from "@/components/ravine";

export function LandingPage({ ready }: { ready: boolean }) {
  return (
    <Providers>
      <div className="landing-shell relative min-h-screen bg-background text-foreground selection:bg-accent selection:text-black">
        {/* Fixed site frame */}
        <div className="site-frame site-frame--top" aria-hidden="true" />
        <div className="site-frame site-frame--bottom" aria-hidden="true" />
        <div className="site-frame site-frame--left" aria-hidden="true" />
        <div className="site-frame site-frame--right" aria-hidden="true" />

        {/* Decorative corner svgs */}
        <svg
          className="site-corner site-corner--top-left"
          width="50"
          height="50"
          viewBox="0 0 50 50"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M5.50871e-06 0C-0.00788227 37.3001 8.99616 50.0116 50 50H5.50871e-06V0Z"
            fill="currentColor"
          />
        </svg>
        <svg
          className="site-corner site-corner--top-right"
          width="50"
          height="50"
          viewBox="0 0 50 50"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M5.50871e-06 0C-0.00788227 37.3001 8.99616 50.0116 50 50H5.50871e-06V0Z"
            fill="currentColor"
          />
        </svg>
        <svg
          className="site-corner site-corner--bottom-left"
          width="50"
          height="50"
          viewBox="0 0 50 50"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M5.50871e-06 0C-0.00788227 37.3001 8.99616 50.0116 50 50H5.50871e-06V0Z"
            fill="currentColor"
          />
        </svg>
        <svg
          className="site-corner site-corner--bottom-right"
          width="50"
          height="50"
          viewBox="0 0 50 50"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M5.50871e-06 0C-0.00788227 37.3001 8.99616 50.0116 50 50H5.50871e-06V0Z"
            fill="currentColor"
          />
        </svg>

        <SkipLink />
        <Header ready={ready} />
        <ThemeSwitch />

        <main id="main" className="landing-main relative flex-1 w-full">
          <Hero />
          <BlurInHeadline />
          <FeaturesBento />
          <CounterfactualMatrix />
          <HowItWorks />
          <section id="go-deeper" className="relative w-full overflow-hidden border-y border-border/40 my-16 bg-[#0a0a0a] scroll-mt-32 sm:scroll-mt-40">
            <Ravine
              className="h-[520px] w-full"
              speed={1}
              steps={128}
              scale={0.25}
              height={1}
              fade={35}
              cameraHeight={6}
              nearColor="#ffffff"
              farColor="#0a0a0a"
              brightness={0.8}
            >
              <div className="flex h-full flex-col items-center justify-center text-center px-6">
                <div className="flex flex-col items-center justify-center p-8 sm:p-10 rounded-2xl bg-black/80 backdrop-blur-md border border-white/15 shadow-2xl max-w-xl z-10">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/90 px-3.5 py-1 font-mono text-xs text-white/90 shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>3D RAYMARCHED TOPOLOGY</span>
                  </div>
                  <h1 className="text-5xl sm:text-6xl font-medium text-white tracking-tight drop-shadow-lg">
                    Go deeper
                  </h1>
                  <p className="mt-3 text-sm sm:text-base text-neutral-200 font-sans leading-relaxed drop-shadow">
                    Continuous gradient recall across 5 storage tiers with zero loss under load-bearing deletion.
                  </p>
                </div>
              </div>
            </Ravine>
          </section>
          <Pricing />
          <FAQ />
          <Footer />
        </main>
      </div>
    </Providers>
  );
}
