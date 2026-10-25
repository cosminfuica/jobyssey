# One server: Hono API serving a React + Vite web app

`apps/api` is a Hono server on Node that also serves the built `apps/web` (React, Vite, TypeScript, TanStack Router and Query, Tailwind CSS and shadcn/ui, no server rendering), so Jobyssey runs as one process. Each feature's frontend calls its API through Hono's typed client (Hono RPC), one client per feature so editor type-checking stays fast, and zod validates every request; the API stays plain HTTP and JSON so people can script against it. There is no mobile app in v1.

## Considered Options

- **Next.js**: server rendering and SEO that a logged-in app does not need, plus a second server to run.
- **tRPC**: excellent types, but not a plain HTTP API.
- **NestJS**: heavy, and its own module system competes with the package boundaries.
- **Fastify**: solid, but a typed client needs extra code generation.
- **Serverless hosting for the API**: Runs last minutes and exceed serverless time limits.
