import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNoneAdapter } from "@jobyssey/auth";
import {
  acquireDataDirLock,
  coreMigrations,
  DataDirLockedError,
  openDatabase,
} from "@jobyssey/db";
import { Hono } from "hono";
import { afterAll, expect, test, vi } from "vitest";
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
  "a start that fails after openDatabase releases the data folder lock",
  { timeout: TIMEOUT },
  async () => {
    const dir = join(tmp, "failed-start");
    await expect(
      runApi({
        ...options({ JOBYSSEY_DATA_DIR: dir }),
        createAuth: () => Promise.reject(new Error("adapter failed")),
      })
    ).rejects.toThrow("adapter failed");
    expect(existsSync(join(dir, "jobyssey.lock"))).toBe(false);
    // This process no longer holds the folder either.
    acquireDataDirLock(dir)();
  }
);

test.runIf(process.env.TEST_DB === "postgres")(
  "an idle pool client killed by the server is logged and the API keeps answering",
  { timeout: TIMEOUT },
  async () => {
    const base = process.env.DATABASE_URL ?? "";
    const name = `jobyssey_test_${randomBytes(6).toString("hex")}`;
    const admin = await openDatabase({
      dataDir: "memory://",
      databaseUrl: base,
    });
    await admin.db.execute(`CREATE DATABASE "${name}"`);
    const url = new URL(base);
    url.pathname = `/${name}`;
    // runApi builds its own pino logger, which writes through process.stdout.write once that is replaced.
    const write = process.stdout.write.bind(process.stdout);
    let logged!: () => void;
    const poolError = new Promise<void>((resolve) => (logged = resolve));
    const spy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk, encoding, callback) => {
        // The expected error lines are consumed here; everything else still reaches the terminal.
        if (!String(chunk).includes('"msg":"database pool error"'))
          return write(chunk, encoding, callback);
        logged();
        return true;
      });
    try {
      const api = await runApi(
        options({
          DATABASE_URL: url.toString(),
          JOBYSSEY_DATA_DIR: join(tmp, "postgres"),
          LOG_LEVEL: "error",
        })
      );
      try {
        // Startup (migrations, the single account) left idle clients in the pool; pg keeps them for 10 s.
        expect((await fetch(api.url + "/api/probe/whoami")).status).toBe(200);
        await admin.db.execute(
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${name}'`
        );
        let timer: NodeJS.Timeout | undefined;
        await Promise.race([
          poolError,
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("no database pool error logged in 10 s")),
              10_000
            );
          }),
        ]).finally(() => clearTimeout(timer));
        expect((await fetch(api.url + "/api/probe/whoami")).status).toBe(200);
      } finally {
        await api.close();
      }
    } finally {
      spy.mockRestore();
      await admin.db.execute(`DROP DATABASE IF EXISTS "${name}"`);
      await admin.close();
    }
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
