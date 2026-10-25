#!/usr/bin/env bash
# Applies the repository settings that live in this folder. The owner runs it after pushing `main`; see README.md.
# Idempotent: every call sets a value, creates-or-updates a label, or updates the ruleset it finds by name.
# `--dry-run` prints every write call instead of running it; only read-only GET calls still run.
set -euo pipefail

usage() {
  echo "usage: apply-repo-settings.sh [--dry-run]" >&2
}

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "unknown argument: $arg" >&2
      usage
      exit 2
      ;;
  esac
done

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

# Every call that writes to GitHub goes through run or try, so --dry-run cannot reach it.
show() {
  local line="DRY RUN:" arg
  for arg in "$@"; do
    if [[ $arg =~ ^[A-Za-z0-9_@%+=:,./-]+$ ]]; then line+=" $arg"; else line+=" \"$arg\""; fi
  done
  echo "$line"
}

run() {
  if [ "$DRY_RUN" = 1 ]; then
    show "$@"
  else
    "$@" > /dev/null
  fi
}

# try <regex> <message> <command...>: like run, but when the command fails with an HTTP status matching <regex>, print <message> and continue.
try() {
  local pattern=$1 message=$2 output
  shift 2
  if [ "$DRY_RUN" = 1 ]; then
    show "$@"
  elif ! output=$("$@" 2>&1); then
    if [[ $output =~ $pattern ]]; then
      echo "$message"
      echo "  GitHub said: $output"
    else
      echo "$output" >&2
      return 1
    fi
  fi
}

info=$(gh repo view --json nameWithOwner,visibility --jq '.nameWithOwner + " " + .visibility')
read -r REPO VISIBILITY <<< "$info"
echo "repository: $REPO ($VISIBILITY)"
[ "$DRY_RUN" = 1 ] && echo "dry run: nothing is written"

public_only() {
  echo "skipped (public repositories only): run again after the repository is public"
}

echo "1. repository settings"
run gh api -X PATCH "repos/$REPO" \
  -f default_branch=main \
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
  -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY \
  -F delete_branch_on_merge=true -F allow_update_branch=true \
  -F has_discussions=true -F has_wiki=false -F has_projects=false

echo "2. private vulnerability reporting"
if [ "$VISIBILITY" = PUBLIC ]; then
  run gh api -X PUT "repos/$REPO/private-vulnerability-reporting"
else
  public_only
fi

echo "3. vulnerability alerts"
run gh api -X PUT "repos/$REPO/vulnerability-alerts"

echo "4. labels"
labels=$(node -e '
  for (const l of JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")))
    console.log([l.name, l.color, l.description].join("\t"));
' "$HERE/labels.json")
while IFS=$'\t' read -r name color description; do
  run gh label create "$name" --repo "$REPO" --color "$color" --description "$description" --force
done <<< "$labels"

echo "5. ruleset for main"
ruleset_skipped="skipped: rulesets need a public repository or GitHub Pro/Team; run again after going public"
# This GET also runs in --dry-run: it decides between updating and creating.
if ! ruleset_id=$(gh api "repos/$REPO/rulesets" --jq '.[] | select(.name == "main") | .id' 2>&1); then
  if [[ $ruleset_id =~ HTTP\ (403|422) ]]; then
    echo "$ruleset_skipped"
    echo "  GitHub said: $ruleset_id"
    ruleset_id=skip
  else
    echo "$ruleset_id" >&2
    exit 1
  fi
fi
if [ "$ruleset_id" = skip ]; then
  :
elif [ -n "$ruleset_id" ]; then
  try 'HTTP (403|422)' "$ruleset_skipped" \
    gh api -X PUT "repos/$REPO/rulesets/$ruleset_id" --input "$HERE/rulesets/main.json"
else
  try 'HTTP (403|422)' "$ruleset_skipped" \
    gh api -X POST "repos/$REPO/rulesets" --input "$HERE/rulesets/main.json"
fi

echo "6. fork pull request approval"
if [ "$VISIBILITY" = PUBLIC ]; then
  try 'HTTP 404' 'not available through the API: set Settings > Actions > General > "Require approval for all external contributors"' \
    gh api -X PUT "repos/$REPO/actions/permissions/fork-pr-contributor-approval" -f approval_policy=all_external_contributors
else
  public_only
fi

echo "7. manual steps no API covers"
cat << EOF
- Install the Renovate GitHub App on $REPO.
- Link $REPO at https://cla-assistant.io and upload .github/CLA.md. Allowlist the owner account and *[bot] users so release and dependency pull requests are not blocked.
- Create the RELEASE_PLEASE_TOKEN secret: a fine-grained personal access token with contents and pull requests read/write.
- Open one pull request and confirm the license/cla check name; the ruleset expects exactly that name.
- Optional, to accept pull requests from collaborators only (not applied by this script):
# gh api -X PATCH repos/$REPO -f pull_request_creation_policy=collaborators_only
EOF
