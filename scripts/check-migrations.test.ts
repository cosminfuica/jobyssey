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

test.each([
  ["truncate-unmarked", "0001_truncate_notes.sql"],
  ["rename-unmarked", "0001_rename_id.sql"],
  ["alter-type-unmarked", "0001_change_id_type.sql"],
])("%s without the expand-contract marker is one problem", (name, file) => {
  const problems = checkMigrations(fixture(name));
  expect(problems).toHaveLength(1);
  expect(problems[0]).toContain(file);
});

test("DROP TABLE in a file with the expand-contract marker passes", () => {
  expect(checkMigrations(fixture("drop-marked"))).toEqual([]);
});

test("a journal whose timestamps go backwards is one problem", () => {
  const problems = checkMigrations(fixture("out-of-order"));
  expect(problems).toHaveLength(1);
  expect(problems[0]).toContain("0001_add_title");
});

test("a journal whose idx goes backwards is one problem", () => {
  expect(checkMigrations(fixture("idx-out-of-order"))).toEqual([
    "0001_add_title: idx 0 does not follow 0000_create_notes (1); sort entries by idx",
  ]);
});

test("a journal entry without its SQL file is one problem", () => {
  expect(checkMigrations(fixture("missing-sql"))).toEqual([
    "0001_add_title: journal entry has no 0001_add_title.sql",
  ]);
});

test("a SQL file missing from the journal is one problem", () => {
  const problems = checkMigrations(fixture("orphan-sql"));
  expect(problems).toHaveLength(1);
  expect(problems[0]).toContain("0001_add_title.sql");
});
