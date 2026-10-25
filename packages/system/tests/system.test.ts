import type { AccountId } from "@jobyssey/accounts";
import type { FeatureDeps, FeatureEnv } from "@jobyssey/api-shell";
import { Hono } from "hono";
import { expect, test } from "vitest";
import { getSystemStatus } from "../index.ts";
import { createSystemRoutes, systemFeature } from "../server.ts";

const deps = { version: "1.2.3", driver: "pglite" } as const;

test("GET /status reports version, Node, database driver and account", async () => {
  const routes = createSystemRoutes(deps);
  const app = new Hono<FeatureEnv>()
    .use("*", (c, next) => {
      c.set("accountId", "acc-1" as AccountId);
      return next();
    })
    .route("/", routes);
  const res = await app.request("/status");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({
    name: "Jobyssey",
    version: "1.2.3",
    node: process.version,
    database: { driver: "pglite" },
    accountId: "acc-1",
  });
});

test("the status function returns its input values", () => {
  expect(
    getSystemStatus({
      version: "2.0.0",
      driver: "postgres",
      accountId: "acc-2" as AccountId,
    })
  ).toEqual({
    name: "Jobyssey",
    version: "2.0.0",
    node: process.version,
    database: { driver: "postgres" },
    accountId: "acc-2",
  });
});

test("the feature carries the package name", () => {
  const featureDeps = { ...deps, db: {}, logger: {} } as FeatureDeps;
  expect(systemFeature(featureDeps).name).toBe("system");
});
