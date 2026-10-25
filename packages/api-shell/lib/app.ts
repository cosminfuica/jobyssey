import { existsSync } from "node:fs";
import { serveStatic } from "@hono/node-server/serve-static";
import type { AuthAdapter } from "@jobyssey/auth";
import { Hono } from "hono";
import {
  problem,
  type Feature,
  type FeatureEnv,
  type Logger,
} from "../index.ts";
import { notFound, onError } from "./errors.ts";
import { requestLog } from "./logger.ts";
import { crossSiteGuard, hostGuard, jsonBodyOnly } from "./security.ts";

export function createApp(options: {
  allowedHosts: Set<string>;
  auth: AuthAdapter;
  features: readonly Feature[];
  logger: Logger;
  webDist?: string;
}): Hono {
  const { allowedHosts, auth, features, logger, webDist } = options;
  const app = new Hono();
  // First, so the guards' 403 and 415 refusals are logged too.
  app.use("*", requestLog(logger));
  app.use("*", hostGuard(allowedHosts));
  app.use("*", crossSiteGuard(allowedHosts));
  app.use("/api/*", jsonBodyOnly());
  // Registered before the account middleware, so login callbacks run without an account.
  if (auth.routes !== undefined) app.route("/api/auth", auth.routes);

  const api = new Hono<FeatureEnv>();
  api.use("*", async (c, next) => {
    c.set("accountId", await auth.resolveAccount(c.req.raw));
    await next();
  });
  const names = new Set<string>();
  for (const feature of features) {
    if (feature.name === "auth")
      throw new Error('Feature name "auth" is reserved');
    if (names.has(feature.name))
      throw new Error(
        `Feature "${feature.name}" is mounted twice; feature names must be unique`
      );
    names.add(feature.name);
    api.route("/" + feature.name, feature.routes);
  }
  app.route("/api", api);
  app.all("/api/*", (c) => problem(c, 404, "Not Found"));

  if (webDist !== undefined && existsSync(webDist)) {
    app.use("/*", serveStatic({ root: webDist }));
    // Client-side routes (/status) get the app's index.html.
    app.get("*", serveStatic({ root: webDist, path: "index.html" }));
  }
  app.onError(onError(logger));
  app.notFound(notFound);
  return app;
}
