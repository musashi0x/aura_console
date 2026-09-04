import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Shared flat config for every workspace member.
 * Cross-package imports must use the package name (@aura/*), never a relative
 * path that escapes the package root.
 */
/**
 * Rule severities we insist on. Exported separately so app configs can re-apply
 * them after a downstream preset (Next.js) relaxes the same rules to warnings.
 */
export const strictOverrides = {
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/consistent-type-imports": [
      "error",
      { prefer: "type-imports", fixStyle: "inline-type-imports" },
    ],
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["../../*", "../../../*", "../../../../*"],
            message:
              "Do not import across package boundaries with relative paths. Use the workspace package name (e.g. @aura/db).",
          },
        ],
      },
    ],
  },
};

export const base = tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/drizzle/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.node },
    },
    rules: strictOverrides.rules,
  },
  {
    /**
     * A test directory one level below its subject reaches its own package's
     * siblings with `../../`, which the pattern above cannot tell apart from a
     * genuine cross-package import. Only `../../*` is relaxed, and only for
     * tests: `../../../*` and deeper stay banned, so the escape hatch still
     * cannot leave the package.
     */
    files: ["**/src/*/test/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../../../*", "../../../../*"],
              message:
                "Do not import across package boundaries with relative paths. Use the workspace package name (e.g. @aura/db).",
            },
          ],
        },
      ],
    },
  },
);

export default base;
