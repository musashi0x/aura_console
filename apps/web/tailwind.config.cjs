/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Semantic names backed by the docs token family, so a component asks
        // for a role ("muted label", "panel edge") instead of picking a step on
        // a neutral ramp it invented. Theming happens in the token layer.
        canvas: 'var(--docs-canvas)',
        surface: 'var(--docs-surface)',
        raised: 'var(--docs-raised)',
        line: 'var(--docs-line)',
        'line-strong': 'var(--docs-line-strong)',
        ink: 'var(--docs-ink)',
        muted: 'var(--docs-muted)',
        accent: 'var(--docs-accent)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-error)',
        // Legacy alias still consumed by the agent plan surface.
        'accent-fg': 'var(--rb-accent-fg)',
      },
      borderRadius: {
        'rb-r-sm': 'var(--rb-r-sm)',
        'rb-r-md': 'var(--rb-r-md)',
        'rb-r-lg': 'var(--rb-r-lg)',
        'rb-r-2xl': 'var(--rb-r-2xl)',
      },
    },
  },
  plugins: [],
}
