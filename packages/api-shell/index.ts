import type { AccountId } from "@jobyssey/accounts";
import type { Db, DbDriver } from "@jobyssey/db";
import type { Context, Hono } from "hono";
import type { Schema } from "hono/types";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Logger as PinoLogger } from "pino";

/** @public - for composition roots in other workspaces that pass config values */
export type { Config } from "./lib/config.ts";

export type FeatureEnv = { Variables: { accountId: AccountId } };

export type Feature = {
  readonly name: string;
  readonly routes: Hono<FeatureEnv, Schema, string>;
};

export type FeatureDeps = {
  readonly db: Db;
  readonly driver: DbDriver;
  readonly version: string;
  readonly logger: Logger;
};

export type Logger = PinoLogger;

export class ConfigError extends Error {
  override readonly name = "ConfigError";
}

export function problem(
  c: Context,
  status: ContentfulStatusCode,
  title: string,
  detail?: string
): Response {
  return c.body(
    JSON.stringify({ type: "about:blank", title, status, detail }),
    status,
    { "Content-Type": "application/problem+json" }
  );
}
