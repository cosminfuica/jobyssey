// Pure checks behind the pr-gate workflow: template sections, AI disclosure, linked issue and size. scripts/pr-gate.ts reads the pull request.
const REQUIRED_SECTIONS = [
  "Problem",
  "Approach",
  "How I tested",
  "AI assistance",
  "Linked issue",
] as const;
const ACCEPTED_LABELS: readonly string[] = [
  "ready-for-agent",
  "ready-for-human",
];
export const MAINTAINER_ASSOCIATIONS: readonly string[] = [
  "OWNER",
  "MEMBER",
  "COLLABORATOR",
];
const FIRST_TIMER_ASSOCIATIONS: readonly string[] = [
  "FIRST_TIME_CONTRIBUTOR",
  "FIRST_TIMER",
  "NONE",
];
const FIRST_TIMER_MAX_LINES = 300;
const EXCLUDED_FROM_SIZE =
  /^(pnpm-lock\.yaml|packages\/db\/migrations\/meta\/.*)$/;
const EXEMPT_HEAD_BRANCHES: readonly RegExp[] = [/^release-please--/];
const EXEMPT_AUTHOR_TYPES: readonly string[] = ["Bot"];

const PROMPT = "_Replace this line:";
const FILLER = /^(n\/?a|none|nothing|tbd|todo|-+|\.+)[.!]?$/i;
const FENCE = /^(```|~~~)/;
const ASSISTED = /^Assisted-by: [^()]+ \([^()]+\)$/;

export type GateInput = {
  body: string;
  authorAssociation: string;
  authorType: string;
  headRef: string;
  labels: readonly string[];
  changedLines: number;
  linkedIssues: readonly {
    number: number;
    state: string;
    labels: readonly string[];
  }[];
};

export type FileNode = {
  path: string;
  additions: number;
  deletions: number;
  changeType: string;
};

export type PullRequestData = {
  body: string | null;
  authorAssociation: string;
  author: { __typename: string; login: string } | null;
  headRefName: string;
  additions: number;
  deletions: number;
  labels: { nodes: { name: string }[] };
  files: {
    nodes: FileNode[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
  closingIssuesReferences: {
    nodes: {
      number: number;
      state: string;
      labels: { nodes: { name: string }[] };
    }[];
  };
};

export const PROBLEMS = {
  missing: (name: string) =>
    `Section "## ${name}" is missing. Restore it from .github/pull_request_template.md.`,
  prompt: (name: string) =>
    `Section "## ${name}" still holds the template prompt (the line starting "${PROMPT}"). Replace it with your own text.`,
  empty: (name: string) =>
    `Section "## ${name}" is empty or holds only filler such as "n/a" or "tbd". Write it in your own words.`,
  noCommand:
    'Section "## How I tested" names no command. Put each command you ran in backticks, for example `pnpm check`.',
  aiBoxes: 'Section "## AI assistance": check exactly one box.',
  aiWithoutTrailer:
    'You checked "AI tools were used" but the description has no "Assisted-by: <tool> (<model>)" line.',
  noAiWithTrailer:
    'You checked "No AI tools were used" but the description has an "Assisted-by:" line.',
  noIssue:
    'No linked issue. End the description with "Closes: #<issue>". Open an issue first if there is none; a maintainer accepts it before work starts.',
  notAccepted: (numbers: string) =>
    `Linked issue ${numbers} is not accepted: it must be open and carry the "ready-for-agent" or "ready-for-human" label from a maintainer. The gate re-runs when the label is added.`,
  tooLarge: (lines: number) =>
    `First contributions are limited to ${FIRST_TIMER_MAX_LINES} changed lines; this pull request changes ${lines} (pnpm-lock.yaml and migration snapshots excluded). Split it into smaller pull requests, each with its own accepted issue.`,
};

function fenceMask(lines: readonly string[]): boolean[] {
  let fence: string | undefined;
  return lines.map((line) => {
    if (fence !== undefined) {
      if (line.startsWith(fence)) fence = undefined;
      return true;
    }
    fence = FENCE.exec(line)?.[1];
    return fence !== undefined;
  });
}

// A CommonMark code span opens and closes with backtick runs of the same length; a regex would match the gap between two empty spans.
function hasCodeSpan(line: string): boolean {
  const runs = [...line.matchAll(/`+/g)];
  for (let i = 0; i < runs.length; i++) {
    const open = runs[i]!;
    const close = runs.findIndex(
      (run, j) => j > i && run[0].length === open[0].length
    );
    if (close === -1) continue;
    if (line.slice(open.index + open[0].length, runs[close]!.index).trim())
      return true;
    i = close;
  }
  return false;
}

function prose(lines: readonly string[]): string[] {
  const mask = fenceMask(lines);
  return lines.filter((_, i) => !mask[i]);
}

// Lines are trimmed; text before the first heading goes under "". Headings inside code fences and HTML comments
// (hidden when GitHub renders the body; an unclosed comment hides the rest) do not count; repeated headings merge.
export function splitSections(body: string): Map<string, string[]> {
  // trim() also drops the \r of CRLF bodies.
  const lines = body
    .replace(/<!--[\s\S]*?(?:-->|$)/g, "")
    .split("\n")
    .map((line) => line.trim());
  const mask = fenceMask(lines);
  const sections = new Map<string, string[]>();
  let current: string[] = [];
  sections.set("", current);
  for (const [i, line] of lines.entries()) {
    const heading = mask[i] ? undefined : /^##\s+(.+)$/.exec(line)?.[1];
    if (heading === undefined) {
      current.push(line);
      continue;
    }
    const name = heading.trim();
    current = sections.get(name) ?? [];
    sections.set(name, current);
  }
  return sections;
}

export function isExempt(input: GateInput): boolean {
  // A fork can name its branch release-please--x, so the head branch only counts for maintainers (release-please opens its PRs with the owner's token).
  return (
    EXEMPT_AUTHOR_TYPES.includes(input.authorType) ||
    (MAINTAINER_ASSOCIATIONS.includes(input.authorAssociation) &&
      EXEMPT_HEAD_BRANCHES.some((branch) => branch.test(input.headRef)))
  );
}

export function checkPullRequest(input: GateInput): string[] {
  if (isExempt(input)) return [];
  const maintainer = MAINTAINER_ASSOCIATIONS.includes(input.authorAssociation);
  const sections = splitSections(input.body);
  const problems: string[] = [];
  const filled = new Set<string>();
  for (const name of REQUIRED_SECTIONS) {
    // The project is built with AI tools, so the disclosure carries no information on maintainers' pull requests.
    if (maintainer && name === "AI assistance") continue;
    const lines = sections.get(name);
    const content = (lines ?? []).filter(
      (line) => line !== "" && !FENCE.test(line)
    );
    if (lines === undefined) problems.push(PROBLEMS.missing(name));
    else if (content.some((line) => line.startsWith(PROMPT)))
      problems.push(PROBLEMS.prompt(name));
    else if (
      maintainer &&
      name === "Linked issue" &&
      content.length > 0 &&
      content.every((line) => /^none\.?$/i.test(line))
    )
      filled.add(name);
    else if (content.every((line) => FILLER.test(line)))
      problems.push(PROBLEMS.empty(name));
    else filled.add(name);
  }

  if (filled.has("How I tested")) {
    const lines = sections.get("How I tested") ?? [];
    const mask = fenceMask(lines);
    const named = lines.some((line, i) =>
      mask[i] ? line !== "" && !FENCE.test(line) : hasCodeSpan(line)
    );
    if (!named) problems.push(PROBLEMS.noCommand);
  }

  if (!maintainer && filled.has("AI assistance")) {
    const ai = prose(sections.get("AI assistance") ?? []);
    const noAi = ai.some((line) => /^- \[[xX]\] No AI tools/.test(line));
    const usedAi = ai.some((line) =>
      /^- \[[xX]\] AI tools were used/.test(line)
    );
    const everyLine = [...sections.values()].flatMap(prose);
    if (noAi === usedAi) problems.push(PROBLEMS.aiBoxes);
    else if (usedAi && !everyLine.some((line) => ASSISTED.test(line)))
      problems.push(PROBLEMS.aiWithoutTrailer);
    else if (noAi && everyLine.some((line) => /^Assisted-by:/i.test(line)))
      problems.push(PROBLEMS.noAiWithTrailer);
  }

  if (!maintainer) {
    if (input.linkedIssues.length === 0) problems.push(PROBLEMS.noIssue);
    else if (
      !input.linkedIssues.some(
        (issue) =>
          issue.state === "OPEN" &&
          issue.labels.some((label) => ACCEPTED_LABELS.includes(label))
      )
    )
      problems.push(
        PROBLEMS.notAccepted(
          input.linkedIssues.map((issue) => `#${issue.number}`).join(", ")
        )
      );
  }

  if (
    FIRST_TIMER_ASSOCIATIONS.includes(input.authorAssociation) &&
    input.changedLines > FIRST_TIMER_MAX_LINES &&
    !input.labels.includes("size-ok")
  )
    problems.push(PROBLEMS.tooLarge(input.changedLines));
  return problems;
}

export function sizeLabel(lines: number): string {
  if (lines <= 10) return "size/XS";
  if (lines <= 50) return "size/S";
  if (lines <= 200) return "size/M";
  if (lines <= 500) return "size/L";
  return "size/XL";
}

// files is the complete list across every page of `files`; pr.files holds only the first page.
export function gateInput(
  pr: PullRequestData,
  files: readonly FileNode[]
): GateInput {
  const excluded = files
    .filter((file) => EXCLUDED_FROM_SIZE.test(file.path))
    .reduce((sum, file) => sum + file.additions + file.deletions, 0);
  return {
    body: pr.body ?? "",
    authorAssociation: pr.authorAssociation,
    authorType: pr.author?.__typename ?? "",
    headRef: pr.headRefName,
    labels: pr.labels.nodes.map((label) => label.name),
    changedLines: pr.additions + pr.deletions - excluded,
    linkedIssues: pr.closingIssuesReferences.nodes.map((issue) => ({
      number: issue.number,
      state: issue.state,
      labels: issue.labels.nodes.map((label) => label.name),
    })),
  };
}
