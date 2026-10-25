import { existsSync } from "node:fs";
import { serve, type ServerType } from "@hono/node-server";
import type { AuthAdapter } from "@jobyssey/auth";
import {
  DataDirLockedError,
  migrateDatabase,
  openDatabase,
  type Db,
  type MigrationSet,
} from "@jobyssey/db";
import type { Hono } from "hono";
import { ConfigError, type Feature, type FeatureDeps } from "../index.ts";
import { createApp } from "./app.ts";
import { loadConfig, type Config } from "./config.ts";
import { createLogger } from "./logger.ts";
import { loopbackHosts } from "./security.ts";

export type RunApiOptions = {
  env: Record<string, string | undefined>;
  version: string;
  webDist?: string;
  migrationSets: readonly MigrationSet[];
  createAuth: (deps: { db: Db }) => Promise<AuthAdapter>;
  createFeatures: (deps: FeatureDeps) => readonly Feature[];
  handleSignals?: boolean;
};

export type RunningApi = { url: string; close(): Promise<void> };

function listen(
  app: Hono,
  config: Config,
  allowedHosts: Set<string>
): Promise<{ server: ServerType; port: number }> {
  return new Promise((resolve, reject) => {
    const server = serve(
      { fetch: app.fetch, port: config.PORT, hostname: config.HOST },
      (info) => {
        // The bound port is known only now (PORT 0); no request can arrive before this callback.
        for (const host of loopbackHosts(info.port)) allowedHosts.add(host);
        server.off("error", reject);
        resolve({ server, port: info.port });
      }
    );
    server.once("error", reject);
  });
}

function closeServer(server: ServerType): Promise<void> {
  return new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
}

export async function runApi(options: RunApiOptions): Promise<RunningApi> {
  const config = loadConfig(options.env);
  const logger = createLogger(config.LOG_LEVEL);
  const handle = await openDatabase({
    dataDir: config.JOBYSSEY_DATA_DIR,
    databaseUrl: config.DATABASE_URL,
    onError: (err) => logger.error({ err }, "database pool error"),
  });
  let server: ServerType;
  let port: number;
  try {
    const { applied, snapshot } = await migrateDatabase(handle, {
      sets: options.migrationSets,
      log: (message) => logger.info(message),
    });
    logger.info({ applied, snapshot }, "migrations done");
    const auth = await options.createAuth({ db: handle.db });
    const features = options.createFeatures({
      db: handle.db,
      driver: handle.driver,
      version: options.version,
      logger,
    });
    const allowedHosts = new Set(config.ALLOWED_HOSTS);
    const app = createApp({
      allowedHosts,
      auth,
      features,
      logger,
      webDist: options.webDist,
    });
    ({ server, port } = await listen(app, config, allowedHosts));
  } catch (error) {
    // Release the data folder lock before reporting the failure.
    try {
      await handle.close();
    } catch (closeError) {
      logger.error({ err: closeError }, "closing the database failed");
    }
    throw error;
  }

  if (options.webDist !== undefined && !existsSync(options.webDist))
    logger.warn("Web app not built; run pnpm build");
  const host = config.HOST.includes(":") ? `[${config.HOST}]` : config.HOST;
  const url = `http://${host}:${port}`;
  logger.info(`Jobyssey listening on ${url}`);

  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      try {
        await closeServer(server);
      } finally {
        await handle.close();
      }
    })());

  if (options.handleSignals !== false) {
    const onSignal = () => {
      close().then(
        () => process.exit(0),
        (error: unknown) => {
          logger.error({ err: error }, "shutdown failed");
          process.exit(1);
        }
      );
    };
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
  }
  return { url, close };
}

export async function runApiOrExit(
  options: RunApiOptions
): Promise<RunningApi> {
  try {
    return await runApi(options);
  } catch (error) {
    if (error instanceof ConfigError || error instanceof DataDirLockedError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
}
