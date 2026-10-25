// Reads one pull request over GraphQL and writes the gate verdict to $GITHUB_OUTPUT (.github/workflows/pr-gate.yml).
// Problems never fail this script; the workflow's last step does. PR_FIXTURE=<file> replaces the GraphQL call
// with a JSON array of responses, one per request, for local dry runs.
import { appendFileSync, readFileSync } from "node:fs";
import type { FileNode, PullRequestData } from "./lib/pr-gate.ts";
import {
  MAINTAINER_ASSOCIATIONS,
  checkPullRequest,
  gateInput,
  isExempt,
  sizeLabel,
} from "./lib/pr-gate.ts";

const QUERY = `query ($owner: String!, $name: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      body
      authorAssociation
      author { __typename login }
      headRefName
      additions
      deletions
      labels(first: 50) { nodes { name } }
      files(first: 100, after: $cursor) {
        nodes { path additions deletions changeType }
        pageInfo { hasNextPage endCursor }
      }
      closingIssuesReferences(first: 10) {
        nodes { number state labels(first: 50) { nodes { name } } }
      }
    }
  }
}`;

// Kebab-case only: a path is PR-controlled and a newline in it would add lines to $GITHUB_OUTPUT.
const NEW_SCOPE =
  /^(?:apps|packages|tooling)\/([a-z0-9][a-z0-9-]*)\/package\.json$/;

type Response = {
  data?: { repository: { pullRequest: PullRequestData | null } | null };
  errors?: unknown;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const fixture = process.env.PR_FIXTURE;
const fixturePages = fixture
  ? (JSON.parse(readFileSync(fixture, "utf8")) as Response[])
  : [];
let requests = 0;

async function request(cursor: string | null): Promise<Response> {
  if (fixture) {
    const page = fixturePages[requests++];
    if (page === undefined)
      throw new Error(`${fixture} has no response number ${requests}`);
    return page;
  }
  const [owner, name] = required("GITHUB_REPOSITORY").split("/");
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      authorization: `bearer ${required("GITHUB_TOKEN")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { owner, name, number: Number(required("PR_NUMBER")), cursor },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok)
    throw new Error(
      `GraphQL request failed: ${response.status} ${await response.text()}`
    );
  return (await response.json()) as Response;
}

async function fetchPage(cursor: string | null): Promise<PullRequestData> {
  const response = await request(cursor);
  const pr = response.data?.repository?.pullRequest;
  if (response.errors !== undefined || !pr)
    throw new Error(
      `GraphQL returned no pull request: ${JSON.stringify(response.errors ?? response)}`
    );
  return pr;
}

const pr = await fetchPage(null);
const files: FileNode[] = [...pr.files.nodes];
let pageInfo = pr.files.pageInfo;
while (pageInfo.hasNextPage) {
  if (!pageInfo.endCursor)
    throw new Error("files.pageInfo has a next page but no endCursor");
  const next = await fetchPage(pageInfo.endCursor);
  files.push(...next.files.nodes);
  pageInfo = next.files.pageInfo;
}

const input = gateInput(pr, files);
const newScopes = files
  .filter((file) => file.changeType === "ADDED")
  .map((file) => NEW_SCOPE.exec(file.path)?.[1])
  .filter((scope) => scope !== undefined);
const outputs = {
  problems: JSON.stringify(checkPullRequest(input)),
  size_label: sizeLabel(input.changedLines),
  new_scopes: newScopes.join(","),
  is_maintainer: String(
    MAINTAINER_ASSOCIATIONS.includes(input.authorAssociation)
  ),
  exempt: String(isExempt(input)),
};
const lines = Object.entries(outputs)
  .map(([key, value]) => `${key}=${value}\n`)
  .join("");
appendFileSync(required("GITHUB_OUTPUT"), lines);
process.stdout.write(lines);
