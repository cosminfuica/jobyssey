import type { Feature, FeatureDeps, FeatureEnv } from "@jobyssey/api-shell";
import { Hono } from "hono";
import { getSystemStatus } from "./index.ts";
import { featureName } from "./shared.ts";

// Handlers stay chained so hc<SystemRoutes> sees every route.
export function createSystemRoutes(
  deps: Pick<FeatureDeps, "version" | "driver">
) {
  return new Hono<FeatureEnv>().get("/status", (c) =>
    c.json(getSystemStatus({ ...deps, accountId: c.get("accountId") }), 200)
  );
}

export type SystemRoutes = ReturnType<typeof createSystemRoutes>;

export const systemFeature = (deps: FeatureDeps): Feature => ({
  name: featureName,
  routes: createSystemRoutes(deps),
});
