import next from "@aura/eslint-config/next";

/* `astryx theme build` regenerates the theme artifacts on every theme change
   and stamps them "do not edit manually", so a lint fix inside them is undone
   by the next build. The generated .d.ts uses a triple-slash reference to pull
   in the theme's Badge variant augmentation — that is how TypeScript delivers
   declaration merging, not a style choice this repo gets to make. */
const config = [
  ...next,
  { ignores: ["src/themes/**/*.d.ts", "src/themes/**/*.js"] },
];

export default config;
