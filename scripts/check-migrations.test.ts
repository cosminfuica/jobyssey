import { join } from "node:path";
import { expect, test } from "vitest";
import { checkMigrations } from "./check-migrations.ts";

const fixture = (name: string) =>
  join(import.meta.dirname, "..", "tests", "fixtures", "migrations", name);

test("a clean journal with additive SQL has no problems", () => {
  expect(checkMigrations(fixture("clean"))).toEqual([]);
});

test("DROP TABLE without the expand-contract marker is one problem", () => {
  const problems = checkMigrations(fixture("drop-unmarked"));
  expect(problems).toHaveLength(1);
  expect(problems[0]).toContain("0001_drop_notes.sql");
});

test("DROP TABLE in a file with the expand-contract marker passes", () => {
  expect(checkMigrations(fixture("drop-marked"))).toEqual([]);
});

test("a journal whose timestamps go backwards is one problem", () => {
  const problems = checkMigrations(fixture("out-of-order"));
  expect(problems).toHaveLength(1);
  expect(problems[0]).toContain("0001_add_title");
});

test("a SQL file missing from the journal is one problem", () => {
  const problems = checkMigrations(fixture("orphan-sql"));
  expect(problems).toHaveLength(1);
  expect(problems[0]).toContain("0001_add_title.sql");
});
