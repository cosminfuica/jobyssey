# @jobyssey/web-shell

## Purpose

The frame every Jobyssey web app renders: the header, the providers and a
router built from a list of features (public ADR 0003, 0005).

## Entry points

`client.tsx` (`@jobyssey/web-shell/client`; this package has no Node entry):

- `WebFeature`: `{ name, nav?, route }`. `nav` adds a header link
  (`{ label, to }`); `route(parent)` returns the feature's route, created
  with `createRoute({ getParentRoute: () => parent, ... })`.
- `createAppRouter({ features, home? })`: a TanStack Router (code-based
  routing) whose root renders the header with the product name and one link
  per feature, and the matched route below it. The index route `/` shows a
  "Jobyssey is running" card, or redirects to `home` when it is set.
- `AppProviders({ router })`: the TanStack Query client and the router.

## Rules

- Browser code only: dependency-cruiser `node-code-no-tsx-or-react` keeps Node code from importing it, and `client-code-no-node-values` keeps it from importing Node values.

### Trade-off

Feature routes arrive as a list of `AnyRoute`, so `<Link to>` is checked as
a string, not against the route tree. Each feature takes its route paths from
the constants in its own `shared.ts`, which both its routes and its links
use.

## Tests

`tests/app-shell.test.tsx` builds routers in Node (no DOM) and checks the
route tree and the index redirect.
