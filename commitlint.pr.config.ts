import { createCommitlintConfig } from "./commitlint.config.ts";

export default createCommitlintConfig({
  squash: process.env.COMMITLINT_REQUIRE_ISSUE === "1",
  extraScopes: (process.env.COMMITLINT_EXTRA_SCOPES ?? "")
    .split(",")
    .filter(Boolean),
});
