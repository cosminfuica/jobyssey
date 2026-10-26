import { execFile } from "node:child_process";
import { expect, test } from "vitest";

function lint(
  message: string,
  config = "commitlint.config.ts",
  env: NodeJS.ProcessEnv = {}
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "pnpm",
      ["exec", "commitlint", "--config", config],
      { timeout: 20_000, env: { ...process.env, ...env } },
      (error) => {
        if (!error) resolve(0);
        // A timeout or spawn failure must fail the test, not count as a rejected message.
        else if (typeof error.code === "number") resolve(error.code);
        else reject(new Error(`commitlint did not run: ${error.message}`));
      }
    );
    child.stdin?.end(message);
  });
}

const cases: [message: string, ok: boolean][] = [
  ["feat(repo): add migit lock", true],
  ["feat(oxlint-config): tighten rules", true],
  ["feat: add migration sets", false],
  ["fix(sytem): typo", false],
  ["feat(nope): x", false],
  ["fix(repo): x\n\nCloses: 12", false],
  ["fix(repo): x\n\nCloses: #12", true],
  ["fix(repo): x\r\n\r\nCloses: #12\r\n", true],
];

test.concurrent.for(cases)("%j passes: %s", async ([message, ok]) => {
  const code = await lint(message);
  expect(code === 0).toBe(ok);
});

test.concurrent.for([
  ["feat(repo): x", false],
  ["feat(repo): x\n\nBody.\n\nCloses: #12", true],
] as [string, boolean][])(
  "squash config: %j passes: %s",
  async ([message, ok]) => {
    const code = await lint(message, "commitlint.pr.config.ts", {
      COMMITLINT_REQUIRE_ISSUE: "1",
    });
    expect(code === 0).toBe(ok);
  }
);
