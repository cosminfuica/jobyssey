import { defineConfig, globalIgnores } from "eslint/config";
import { base, react, nodeScripts, ignores } from "@jobyssey/eslint-config";

export default defineConfig([
  globalIgnores([
    ...ignores,
    ".omo/**",
    ".agents/**",
    "tests/boundaries/fixtures/**",
    "**/tests/fixtures/**",
    "packages/db/migrations/**",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [base],
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: [
      "apps/web/**/*.{ts,tsx}",
      "packages/*/client.tsx",
      "packages/ui/src/**/*.{ts,tsx}",
      "packages/web-shell/**/*.{ts,tsx}",
    ],
    extends: [react],
  },
  // Composition roots, scripts, config files, config packages and tests read the environment; keep in step with check-workspace CW17.
  {
    files: [
      "apps/*/src/main.ts",
      "apps/*/src/dev.ts",
      "scripts/**/*.ts",
      "**/*.config.{ts,js}",
      "tooling/**/*.{ts,js}",
      "**/tests/**/*.{ts,tsx}",
    ],
    rules: { "no-restricted-syntax": "off" },
  },
  ...nodeScripts,
]);
