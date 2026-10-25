import type { MiddlewareHandler } from "hono";
import { problem } from "../index.ts";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Browsers omit the default port from Host and Origin.
export function loopbackHosts(port: number): string[] {
  const hosts = [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`];
  if (port === 80 || port === 443)
    hosts.push("127.0.0.1", "localhost", "[::1]");
  return hosts;
}

// The set is read on every request: runApi adds the loopback entries once the port is bound.
export function hostGuard(hosts: Set<string>): MiddlewareHandler {
  return async (c, next) => {
    const host = c.req.header("host")?.toLowerCase();
    if (host === undefined || !hosts.has(host))
      return problem(c, 403, "Forbidden host");
    await next();
  };
}

function originHost(origin: string): string | undefined {
  try {
    return new URL(origin).host;
  } catch {
    return undefined;
  }
}

// Requests without Sec-Fetch-Site and Origin (curl, scripts) pass; browsers always send one of them.
export function crossSiteGuard(hosts: Set<string>): MiddlewareHandler {
  return async (c, next) => {
    if (!SAFE_METHODS.has(c.req.method)) {
      const site = c.req.header("sec-fetch-site");
      if (site !== undefined && site !== "same-origin" && site !== "none")
        return problem(c, 403, "Cross-site request blocked");
      const origin = c.req.header("origin");
      if (origin !== undefined) {
        // "null" (sandboxed frames, file://) and other non-URLs do not parse and are refused.
        const host = originHost(origin);
        if (host === undefined || !hosts.has(host))
          return problem(c, 403, "Cross-site request blocked");
      }
    }
    await next();
  };
}

// Only JSON bodies: HTML forms cannot send them cross-site without a preflight.
export function jsonBodyOnly(): MiddlewareHandler {
  return async (c, next) => {
    if (!SAFE_METHODS.has(c.req.method)) {
      const length = c.req.header("content-length");
      const hasBody =
        (length !== undefined && Number(length) !== 0) ||
        c.req.header("transfer-encoding") !== undefined;
      const type = c.req.header("content-type")?.toLowerCase() ?? "";
      if (hasBody && !type.startsWith("application/json"))
        return problem(
          c,
          415,
          "Unsupported Media Type",
          "Request bodies must be application/json."
        );
    }
    await next();
  };
}
