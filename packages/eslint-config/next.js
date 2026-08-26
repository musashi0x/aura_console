import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

import { base, strictOverrides } from "./base.js";

/**
 * Shared flat config for Next.js applications. The strict overrides come last:
 * the Next presets downgrade some of the same rules to warnings.
 */
export const next = [
  ...base,
  ...nextCoreWebVitals,
  ...nextTypescript,
  strictOverrides,
];

export default next;
