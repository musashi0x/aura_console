/**
 * ============================================================================
 * AURA MEMORY — SITE CONFIGURATION
 * ============================================================================
 *
 * Centralized site configuration for Aura Memory landing page & telemetry console.
 */

export const siteConfig = {
  // Brand
  name: "Aura Memory",
  tagline: "Autonomous Agents That Never Forget",
  description:
    "Persistent relationship memory layer and fail-closed command console for autonomous AI agents. Powered by Sibyl Memory, Base Sepolia cryptographic proof, and Virtuals Protocol ACP.",

  // URLs
  url: "https://github.com/musashi0x/aura_memory",
  github: "https://github.com/musashi0x/aura_memory",
  twitter: "@musashi0x",

  // Navigation
  nav: {
    cta: {
      text: "Join Pilot Waitlist",
      href: "#waitlist",
    },
    github: {
      text: "GitHub Repository",
      href: "https://github.com/musashi0x/aura_memory",
    },
  },
};

export const heroConfig = {
  badge: "SIBYL MEMORY • BASE SEPOLIA • VIRTUALS ACP",
  headline: {
    line1: "Autonomous Agents That",
    line2: "Never",
    accent: "Forget",
  },
  subheadline:
    "Aura uses delivery history stored in Sibyl Memory to help your agent decide who to hire in a new session.",
  cta: {
    text: "Explore Live Console",
    href: "#console-preview",
  },
};

export const blurHeadlineConfig = {
  text: "Autonomous agents spending treasury capital without persistent reputation are destined to repeat costly mistakes. Aura Memory equips AI buyer fleets with cryptographic relationship memory — turning ephemeral LLM runs into an immutable, replayable history of trust, performance, and proof.",
};

export const testimonialsConfig = {
  title: "Trusted by Autonomous Fleets & DAOs",
  subtitle: "Verified Design Partners & Pilot Network",
  autoplayInterval: 9000,
};

export const howItWorksConfig = {
  title: "How Aura Works",
  kicker: "Execution Lifecycle",
  description:
    "From candidate scoring to on-chain notarization, every mission run adheres to strict financial guardrails and load-bearing memory.",
  cta: {
    text: "Read Architecture Docs",
    href: "https://github.com/musashi0x/aura_memory#readme",
  },
};

export const pricingConfig = {
  title: "Autonomous Fleet Deployment Tiers",
  description:
    "Choose the deployment architecture tailored to your AI agent rigs, autonomous protocols, or institutional treasuries.",
  billingNote: "Open Source & Pilot Grants Available",
};

export const faqConfig = {
  title: "Frequently Asked Questions",
  kicker: "Architecture FAQ",
  description:
    "Everything you need to know about Sibyl Memory, fail-closed guardrails, and on-chain proofs.",
};

export const footerConfig = {
  cta: {
    headline: "Equip Your Agent Fleet With Memory",
    subheadline:
      "Join leading autonomous DAOs, procurement protocols, and Virtuals ACP fleets protecting treasury capital with fail-closed reputation.",
    placeholder: "Agent ID or Wallet Address",
    button: "Join Pilot Waitlist",
  },
  copyright: `© ${new Date().getFullYear()} Aura Protocol & Sibyl Labs. MIT License.`,
};

/**
 * ============================================================================
 * FEATURE FLAGS
 * ============================================================================
 */
export const features = {
  smoothScroll: true,
  testimonialAutoplay: true,
  parallaxHero: true,
  blurInHeadline: true,
};

/**
 * ============================================================================
 * THEME CONFIGURATION
 * ============================================================================
 */
export const themeConfig = {
  defaultTheme: "system" as "light" | "dark" | "system",
  enableSystemTheme: true,
};
