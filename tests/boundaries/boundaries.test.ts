import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";

const repo = join(import.meta.dirname, "..", "..");
const fixtures = join(import.meta.dirname, "fixtures");
const depcruise = join(repo, "node_modules", ".bin", "depcruise");

const tmp = mkdtempSync(join(tmpdir(), "jobyssey-boundaries-"));
const coreConfig = join(tmp, "core.dependency-cruiser.cjs");
writeFileSync(
  coreConfig,
  `module.exports = require(${JSON.stringify(join(repo, "dependency-cruiser.rules.cjs"))}).build("core/");\n`
);
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

type Report = { summary: { violations: { rule: { name: string } }[] } };

function violatedRules(fixture: string, prefix = ""): Promise<string[]> {
  const config =
    prefix === "" ? join(repo, ".dependency-cruiser.cjs") : coreConfig;
  const args = ["--config", config, "--output-type", "json"];
  for (const dir of ["apps", "packages", "tooling"]) args.push(prefix + dir);
  return new Promise((resolve, reject) => {
    execFile(
      depcruise,
      args,
      { cwd: join(fixtures, fixture), timeout: 30_000 },
      (error, stdout) => {
        // The json reporter exits 0 even with violations; any error means depcruise did not run.
        if (error)
          return reject(new Error(`depcruise failed: ${error.message}`));
        const report = JSON.parse(stdout) as Report;
        const names = report.summary.violations.map((v) => v.rule.name);
        resolve([...new Set(names)].sort());
      }
    );
  });
}

const cases: [fixture: string, rules: string[]][] = [
  ["ok-entrypoint", []],
  ["deep-import", ["package-internals-private"]],
  ["test-imports-own-lib", ["tests-through-entrypoints"]],
  ["app-imports-internal", ["apps-use-entrypoints"]],
  ["web-imports-server-value", ["client-code-no-node-values"]],
  ["web-imports-server-type", []],
  ["web-imports-index-value", ["client-code-no-node-values"]],
  ["lib-tsx-imports-server-value", ["client-code-no-node-values"]],
  ["lib-ts-imports-tsx", ["node-code-no-tsx-or-react"]],
  ["api-imports-tsx", ["node-code-no-tsx-or-react"]],
  ["unresolvable-import", ["not-to-unresolvable"]],
  ["foreign-schema", ["schema-imports-restricted"]],
  ["schema-to-schema", []],
  ["cycle", ["no-circular"]],
  ["type-cycle", []],
  ["platform-imports-feature", ["platform-never-imports-features"]],
  ["registry-imports-feature", []],
  ["package-imports-app", ["packages-never-import-apps"]],
  ["app-imports-app", ["apps-never-import-apps"]],
  ["shared-imports-index", ["shared-is-browser-safe"]],
  ["shared-imports-node-builtin", ["shared-no-node-builtins"]],
  ["tooling-imports-package", ["tooling-is-leaf"]],
];

test.concurrent.for(cases)(
  "%s violates exactly %j",
  { timeout: 60_000 },
  async ([fixture, rules]) => {
    expect(await violatedRules(fixture)).toEqual(rules);
  }
);

test("core-prefix: build('core/') applies the rules under core/", async () => {
  expect(await violatedRules("core-prefix", "core/")).toEqual([
    "package-internals-private",
  ]);
}, 60_000);
