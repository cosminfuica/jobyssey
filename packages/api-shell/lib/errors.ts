import type { ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { problem, type Logger } from "../index.ts";

export function onError(logger: Logger): ErrorHandler {
  return (error, c) => {
    if (error instanceof HTTPException)
      return problem(c, error.status, error.message || "Request failed");
    logger.error({ err: error }, "unhandled error");
    // No stack or message in the body: it can carry internals.
    return problem(c, 500, "Internal Server Error");
  };
}

export const notFound: NotFoundHandler = (c) => problem(c, 404, "Not Found");
