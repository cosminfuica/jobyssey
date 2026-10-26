// Checks one Drizzle migration folder: journal order, orphan SQL files and destructive statements.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

type Entry = { idx: number; when: number; tag: string };

const MARKER = "-- expand-contract: ok";

// shortcut: a regex, not a SQL parser, so DROP/TRUNCATE inside a comment or string also counts; the marker line clears it, so the error is always safe.
const DESTRUCTIVE =
  /\bDROP\s+(TABLE|COLUMN|SCHEMA|TYPE|INDEX|CONSTRAINT)\b|\bTRUNCATE\b|\bALTER\s+TABLE\b[\s\S]*?\b(ALTER\s+COLUMN\b[\s\S]*?\bTYPE\b|RENAME\b)/i;

function isEntry(value: unknown): value is Entry {
  if (typeof value !== "object" || value === null) return false;
  const { idx, when, tag } = value as Record<string, unknown>;
  return (
    typeof idx === "number" &&
    typeof when === "number" &&
    typeof tag === "string"
  );
}

export function checkMigrations(folder: string): string[] {
  const journalFile = join(folder, "meta", "_journal.json");
  let entries: unknown;
  try {
    entries = (
      JSON.parse(readFileSync(journalFile, "utf8")) as { entries?: unknown }
    ).entries;
  } catch (error) {
    return [`${journalFile}: cannot read the journal (${String(error)})`];
  }
  if (!Array.isArray(entries) || !entries.every(isEntry))
    return [`${journalFile}: "entries" must be an array of { idx, when, tag }`];

  const problems: string[] = [];
  for (const [i, entry] of entries.entries()) {
    const previous = entries[i - 1];
    if (previous === undefined) continue;
    if (entry.idx <= previous.idx)
      problems.push(
        `${entry.tag}: idx ${entry.idx} does not follow ${previous.tag} (${previous.idx}); sort entries by idx`
      );
    if (entry.when <= previous.when)
      problems.push(
        `${entry.tag}: when ${entry.when} is not later than ${previous.tag} (${previous.when}); Drizzle skips migrations that run out of order`
      );
  }

  const files = readdirSync(folder)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const tagged = new Set(entries.map((entry) => `${entry.tag}.sql`));
  for (const entry of entries)
    if (!files.includes(`${entry.tag}.sql`))
      problems.push(`${entry.tag}: journal entry has no ${entry.tag}.sql`);
  for (const file of files)
    if (!tagged.has(file))
      problems.push(`${file}: not listed in meta/_journal.json`);

  for (const file of files) {
    const sql = readFileSync(join(folder, file), "utf8");
    if (sql.split(/\r?\n/).some((line) => line.trim() === MARKER)) continue;
    for (const statement of sql.split(/-->\s*statement-breakpoint|;/))
      if (DESTRUCTIVE.test(statement))
        problems.push(
          `${file}: destructive statement without a "${MARKER}" line: ${statement.trim().replace(/\s+/g, " ").slice(0, 80)}`
        );
  }
  return problems;
}

if (import.meta.main) {
  const folder = process.argv[2] ?? "packages/db/migrations";
  const problems = checkMigrations(folder);
  for (const problem of problems) console.error(problem);
  if (problems.length > 0) {
    console.error(
      `check-migrations: ${problems.length} problem(s) in ${folder}`
    );
    process.exitCode = 1;
  } else console.log(`check-migrations: no problems in ${folder}`);
}
