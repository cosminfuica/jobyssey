import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import type { GateInput, PullRequestData } from "./pr-gate.ts";
import {
  PROBLEMS,
  checkPullRequest,
  gateInput,
  isExempt,
  sizeLabel,
  splitSections,
} from "./pr-gate.ts";

const NO_AI = [
  "- [x] No AI tools were used.",
  "- [ ] AI tools were used. I reviewed every changed line and added an `Assisted-by:` line below.",
];
const USED_AI = [
  "- [ ] No AI tools were used.",
  "- [x] AI tools were used. I reviewed every changed line and added an `Assisted-by:` line below.",
];
const TEMPLATE = readFileSync(".github/pull_request_template.md", "utf8");

function body(
  overrides: Partial<Record<string, string[] | null>> = {}
): string {
  const sections: Record<string, string[] | null> = {
    Summary: [
      "The health endpoint returns 500 when the database is down; it now returns 503, a retry loop was rejected.",
    ],
    Evidence: [
      "- **Before:** `curl -i localhost:4180/api/system/health`: 500.",
      "- **After:** the same call: 503. `pnpm check` passes.",
    ],
    "Merge danger": ["- **Door:** two-way", "- **Blast radius:** api"],
    "AI assistance": NO_AI,
    "Linked issue": ["Closes: #12"],
    ...overrides,
  };
  return Object.entries(sections)
    .filter((entry): entry is [string, string[]] => entry[1] !== null)
    .map(([name, lines]) => `## ${name}\n\n${lines.join("\n")}\n`)
    .join("\n");
}

const ACCEPTED = { number: 12, state: "OPEN", labels: ["ready-for-human"] };

function contributor(overrides: Partial<GateInput> = {}): GateInput {
  return {
    body: body(),
    authorAssociation: "CONTRIBUTOR",
    authorType: "User",
    headRef: "fix-health",
    labels: [],
    changedLines: 40,
    linkedIssues: [ACCEPTED],
    ...overrides,
  };
}

function fixture(name: string): GateInput {
  const [response] = JSON.parse(
    readFileSync(`tests/fixtures/pr-gate/${name}.json`, "utf8")
  ) as { data: { repository: { pullRequest: PullRequestData } } }[];
  const pr = response!.data.repository.pullRequest;
  return gateInput(pr, pr.files.nodes);
}

test("a complete contributor pull request passes", () => {
  expect(checkPullRequest(contributor())).toEqual([]);
});

test.for([
  ["Summary", "missing", null, PROBLEMS.missing("Summary")],
  [
    "Merge danger",
    "prompt",
    ["_Replace this line: fill both lines._"],
    PROBLEMS.prompt("Merge danger"),
  ],
  ["Summary", "empty", [""], PROBLEMS.empty("Summary")],
  ["Evidence", "filler", ["N/A"], PROBLEMS.empty("Evidence")],
  ["Summary", "dashes", ["---"], PROBLEMS.empty("Summary")],
  [
    "Evidence",
    "no command",
    ["- **Before:** it crashed.", "- **After:** it works."],
    PROBLEMS.noCommand,
  ],
  [
    "Evidence",
    "only empty code spans",
    ["I ran `` and ` `."],
    PROBLEMS.noCommand,
  ],
  [
    "Merge danger",
    "labels left empty",
    ["- **Door:**", "- **Blast radius:**"],
    PROBLEMS.mergeDanger,
  ],
  [
    "Merge danger",
    "a door that is neither way",
    ["- **Door:** maybe", "- **Blast radius:** api"],
    PROBLEMS.mergeDanger,
  ],
  [
    "Merge danger",
    "no blast radius",
    ["- **Door:** one-way"],
    PROBLEMS.mergeDanger,
  ],
  [
    "Merge danger",
    "a door only inside a code block",
    ["```", "Door: two-way", "```", "- **Blast radius:** api"],
    PROBLEMS.mergeDanger,
  ],
  [
    "AI assistance",
    "both boxes",
    [
      "- [x] No AI tools were used.",
      "- [x] AI tools were used. I reviewed every changed line.",
    ],
    PROBLEMS.aiBoxes,
  ],
  [
    "AI assistance",
    "no box",
    ["- [ ] No AI tools were used.", "- [ ] AI tools were used."],
    PROBLEMS.aiBoxes,
  ],
  ["AI assistance", "AI without trailer", USED_AI, PROBLEMS.aiWithoutTrailer],
  [
    "AI assistance",
    "no AI with trailer",
    [...NO_AI, "", "Assisted-by: Claude Code (claude-opus-4)"],
    PROBLEMS.noAiWithTrailer,
  ],
] as [string, string, string[] | null, string][])(
  "%s %s -> one problem",
  ([section, , lines, problem]) => {
    const input = contributor({ body: body({ [section]: lines }) });
    expect(checkPullRequest(input)).toEqual([problem]);
  }
);

test.for([
  [
    "plain labels and a sentence",
    ["Door: one-way, the migration drops a column.", "Blast radius: data"],
  ],
  ["star bullets", ["* **Door:** Two-way", "* **Blast radius:** docs"]],
] as [string, string[]][])("Merge danger with %s passes", ([, lines]) => {
  expect(
    checkPullRequest(contributor({ body: body({ "Merge danger": lines }) }))
  ).toEqual([]);
});

test("required headings match in any case, as the pr skill writes them", () => {
  const skillCase = body({
    Summary: null,
    Evidence: null,
    "Merge danger": null,
    summary: ["The health endpoint returns 503 when the database is down."],
    EVIDENCE: ["- **Before:** `pnpm check` failed.", "- **After:** it passes."],
    "Merge Danger": ["**Door:** two-way", "", "**Blast Radius:** api"],
  });
  expect(skillCase).not.toMatch(/^## (Summary|Evidence|Merge danger)$/m);
  expect(checkPullRequest(contributor({ body: skillCase }))).toEqual([]);
});

test("AI tools with an Assisted-by line pass", () => {
  const ai = [...USED_AI, "", "Assisted-by: Claude Code (claude-opus-4)"];
  expect(
    checkPullRequest(contributor({ body: body({ "AI assistance": ai }) }))
  ).toEqual([]);
});

test("a contributor needs a linked issue that is open and accepted", () => {
  expect(checkPullRequest(contributor({ linkedIssues: [] }))).toEqual([
    PROBLEMS.noIssue,
  ]);
  const closed = { ...ACCEPTED, state: "CLOSED" };
  const unlabeled = { number: 13, state: "OPEN", labels: ["needs-triage"] };
  expect(
    checkPullRequest(contributor({ linkedIssues: [closed, unlabeled] }))
  ).toEqual([PROBLEMS.notAccepted("#12, #13")]);
});

test("a contributor writing none as the linked issue fails", () => {
  const input = contributor({
    body: body({ "Linked issue": ["none"] }),
    linkedIssues: [],
  });
  expect(checkPullRequest(input)).toEqual([
    PROBLEMS.empty("Linked issue"),
    PROBLEMS.noIssue,
  ]);
});

test("first-time contributors are capped at 300 changed lines unless size-ok", () => {
  const input = contributor({
    authorAssociation: "FIRST_TIME_CONTRIBUTOR",
    changedLines: 301,
  });
  expect(checkPullRequest(input)).toEqual([PROBLEMS.tooLarge(301)]);
  expect(checkPullRequest({ ...input, changedLines: 300 })).toEqual([]);
  expect(checkPullRequest({ ...input, labels: ["size-ok"] })).toEqual([]);
  expect(
    checkPullRequest({ ...input, authorAssociation: "CONTRIBUTOR" })
  ).toEqual([]);
});

test("a first-timer with an accepted issue passes", () => {
  const input = contributor({
    authorAssociation: "FIRST_TIMER",
    changedLines: 120,
  });
  expect(checkPullRequest(input)).toEqual([]);
});

test("a maintainer passes with the AI prompt left, Linked issue none and no issue", () => {
  const input = contributor({
    authorAssociation: "OWNER",
    linkedIssues: [],
    changedLines: 900,
    body: body({
      "AI assistance": [
        "_Replace this line: check exactly one box below, then delete this line._",
        "",
        "- [ ] No AI tools were used.",
        "- [ ] AI tools were used.",
      ],
      "Linked issue": ["none"],
    }),
  });
  expect(checkPullRequest(input)).toEqual([]);
  expect(
    checkPullRequest({
      ...input,
      body: body({ "Linked issue": ["_Replace this line: x_"] }),
    })
  ).toEqual([PROBLEMS.prompt("Linked issue")]);
});

test("release-please pull requests are exempt; a fork branch with that name is not", () => {
  const input = contributor({
    authorAssociation: "OWNER",
    headRef: "release-please--branches--main",
    body: "Release notes for 0.2.0.",
    linkedIssues: [],
  });
  expect(isExempt(input)).toBe(true);
  expect(checkPullRequest(input)).toEqual([]);
  const fork = { ...input, authorAssociation: "CONTRIBUTOR" };
  expect(isExempt(fork)).toBe(false);
  expect(checkPullRequest(fork)).toContain(PROBLEMS.missing("Summary"));
});

test("bot authors are exempt", () => {
  const input = contributor({ authorType: "Bot", body: "", linkedIssues: [] });
  expect(isExempt(input)).toBe(true);
  expect(checkPullRequest(input)).toEqual([]);
});

test.for([
  [0, "size/XS"],
  [10, "size/XS"],
  [11, "size/S"],
  [50, "size/S"],
  [51, "size/M"],
  [200, "size/M"],
  [201, "size/L"],
  [500, "size/L"],
  [501, "size/XL"],
] as [number, string][])("sizeLabel(%i) = %s", ([lines, label]) => {
  expect(sizeLabel(lines)).toBe(label);
});

test("splitSections handles CRLF and drops HTML comments", () => {
  const sections = splitSections(
    "intro\r\n## Summary  \r\nreal text\r\n<!-- ## Merge danger\r\nhidden -->\r\n## Evidence\r\n`pnpm check`\r\n<!-- unclosed\r\n## Linked issue\r\nCloses: #1"
  );
  expect([...sections.keys()]).toEqual(["", "Summary", "Evidence"]);
  expect(sections.get("Summary")).toEqual(["real text", ""]);
  expect(sections.get("Evidence")).toEqual(["`pnpm check`", ""]);
});

test("fixture template-untouched lists every prompt and the missing issue", () => {
  expect(checkPullRequest(fixture("template-untouched"))).toEqual([
    PROBLEMS.prompt("Summary"),
    PROBLEMS.prompt("Evidence"),
    PROBLEMS.prompt("Merge danger"),
    PROBLEMS.prompt("AI assistance"),
    PROBLEMS.prompt("Linked issue"),
    PROBLEMS.noIssue,
  ]);
  expect(fixture("template-untouched").body).toBe(TEMPLATE);
});

test("fixture ai-box-without-trailer lists only the missing trailer", () => {
  expect(checkPullRequest(fixture("ai-box-without-trailer"))).toEqual([
    PROBLEMS.aiWithoutTrailer,
  ]);
});
