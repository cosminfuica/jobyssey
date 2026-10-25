import { basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { UserConfig } from "@commitlint/types";
import { FIXED_SCOPES, listWorkspaceDirs } from "./scripts/lib/workspace.ts";

const TRAILERS: [prefix: string, format: RegExp][] = [
  ["Closes:", /^Closes: #\d+$/],
  ["Refs:", /^Refs: #\d+(, #\d+)*$/],
  ["Assisted-by:", /^Assisted-by: [^()]+ \([^()]+\)$/],
];

export function createCommitlintConfig(
  options: { root?: string; extraScopes?: string[]; squash?: boolean } = {}
): UserConfig {
  const root = options.root ?? dirname(fileURLToPath(import.meta.url));
  const scopes = [
    ...FIXED_SCOPES,
    ...listWorkspaceDirs(root).map((folder) => basename(folder)),
    ...(options.extraScopes ?? []),
  ];
  return {
    extends: ["@commitlint/config-conventional"],
    plugins: [
      {
        rules: {
          "trailer-format": ({ raw }) => {
            const bad = (raw ?? "")
              .split("\n")
              .map((line) => line.trim())
              .filter((line) =>
                TRAILERS.some(
                  ([prefix, format]) =>
                    line.startsWith(prefix) && !format.test(line)
                )
              );
            return [
              bad.length === 0,
              `trailers must read "Closes: #N", "Refs: #N[, #N]" or "Assisted-by: <tool> (<model>)"; got: ${bad.join(" | ")}`,
            ];
          },
        },
      },
    ],
    rules: {
      "scope-enum": [2, "always", scopes],
      "scope-empty": [2, "never"],
      "header-max-length": [2, "always", 72],
      "body-leading-blank": [2, "always"],
      "footer-leading-blank": [2, "always"],
      "body-max-line-length": [0],
      "footer-max-line-length": [0],
      "trailer-format": [2, "always"],
      ...(options.squash
        ? {
            "body-empty": [2, "never"],
            "trailer-exists": [2, "always", "Closes:"],
          }
        : {}),
    },
  };
}

export default createCommitlintConfig();
