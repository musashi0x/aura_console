/**
 * Vite's `?raw` suffix, used by tests that assert on a module's own source.
 * Vitest resolves it; TypeScript needs telling it exists.
 */
declare module "*?raw" {
  const content: string;
  export default content;
}
