import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/** @typedef {import("eslint").Linter.Config} Config */

/** @type {Config[]} */
export const base = [
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  { languageOptions: { parserOptions: { projectService: true } } },
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.name='process'][property.name='env']",
          message:
            "Read settings through loadConfig; only apps/*/src/main.ts and dev.ts read process.env.",
        },
      ],
      // Under verbatimModuleSyntax only a standalone `import type` is erased; the client/server split relies on it.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },
];

/** @type {Config[]} */
export const react = [...base, reactHooks.configs.flat.recommended];

/** @type {Config[]} */
export const nodeScripts = [
  { files: ["**/*.js"], languageOptions: { globals: globals.node } },
];

/** @type {string[]} */
export const ignores = [
  "**/dist/**",
  "**/node_modules/**",
  "**/.turbo/**",
  "**/coverage/**",
];
