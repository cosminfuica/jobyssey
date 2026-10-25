import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNoneAdapter } from "@jobyssey/auth";
import { coreMigrations, DataDirLockedError } from "@jobyssey/db";
import { Hono } from "hono";
import { afterAll, expect, test } from "vitest";
import { ConfigError, type Feature, type FeatureEnv } from "../index.ts";
import { runApi } from "../server.ts";

// PGlite boots a WebAssembly Postgres per open; generous so a loaded machine cannot fail it.
const TIMEOUT = 60_000;

const tmp = mkdtempSync(join(tmpdir(), "jby-run-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const probeFeature: Feature = {
  name: "probe",
  routes: new Hono<FeatureEnv>().get("/whoami", (c) =>
    c.json({ accountId: c.get("accountId") })
  ),
};

const options = (env: Record<string, string>) => ({
  env: { PORT: "0", JOBYSSEY_DATA_DIR: tmp, LOG_LEVEL: "silent", ...env },
  version: "0.0.0-test",
  migrationSets: [coreMigrations],
  createAuth: createNoneAdapter,
  createFeatures: () => [probeFeature],
  handleSignals: false,
});

test(
  "runApi serves features on the bound port, holds the lock and releases it on close",
  { timeout: TIMEOUT },
  async () => {
    const api = await runApi(options({}));
    try {
      expect(api.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      // fetch sends Host: 127.0.0.1:<bound port>, allowed only once listen has reported the port.
      const res = await fetch(api.url + "/api/probe/whoami");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { accountId: string };
      expect(body.accountId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      await expect(runApi(options({}))).rejects.toThrow(DataDirLockedError);
    } finally {
      await api.close();
    }
    expect(existsSync(join(tmp, "jobyssey.lock"))).toBe(false);
  }
);

test(
  "runApi rejects HOST 0.0.0.0 with a ConfigError",
  { timeout: TIMEOUT },
  async () => {
    await expect(runApi(options({ HOST: "0.0.0.0" }))).rejects.toThrow(
      ConfigError
    );
  }
);
