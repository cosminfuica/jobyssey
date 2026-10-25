import type { MiddlewareHandler } from "hono";
import { pino } from "pino";
import type { Logger } from "../index.ts";
import type { Config } from "./config.ts";

export function createLogger(level: Config["LOG_LEVEL"]): Logger {
  return pino({
    level,
    redact: ["req.headers.cookie", "req.headers.authorization"],
    ...(process.stdout.isTTY ? { transport: { target: "pino-pretty" } } : {}),
  });
}

export function requestLog(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    const start = performance.now();
    await next();
    const entry = {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Math.round(performance.now() - start),
    };
    if (c.req.path.startsWith("/api/")) logger.info(entry, "request");
    else logger.debug(entry, "request");
  };
}
