import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), "utf8");

test("labels.json and docs/guides/labels.md list the same labels", () => {
  const fromJson = (
    JSON.parse(read("./labels.json")) as { name: string }[]
  ).map((label) => label.name);
  const fromDocs = [
    ...read("../../docs/guides/labels.md").matchAll(/^- `([^`]+)`/gm),
  ].flatMap((match) => match[1] ?? []);
  expect(fromJson.filter((name) => !fromDocs.includes(name))).toEqual([]);
  expect(fromDocs.filter((name) => !fromJson.includes(name))).toEqual([]);
  expect(fromJson.length).toBeGreaterThan(0);
});

test("the main ruleset parses and requires ci-summary, pr-gate and license/cla", () => {
  const ruleset = JSON.parse(read("./rulesets/main.json")) as {
    rules: {
      type: string;
      parameters?: { required_status_checks?: { context: string }[] };
    }[];
  };
  const checks = ruleset.rules.find(
    (rule) => rule.type === "required_status_checks"
  );
  const contexts = checks?.parameters?.required_status_checks?.map(
    (check) => check.context
  );
  expect(contexts).toEqual(
    expect.arrayContaining(["ci-summary", "pr-gate", "license/cla"])
  );
});
