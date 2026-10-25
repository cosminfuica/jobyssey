import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { ConfigError } from "../index.ts";

const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"]);

const schema = z.object({
  HOST: z.string().min(1).default("127.0.0.1"),
  // Digits only first: a plain coerce would turn an empty PORT= into 0 (any free port).
  PORT: z
    .string()
    .regex(/^\d+$/, "PORT must be a whole number")
    .transform(Number)
    .pipe(z.number().int().min(0).max(65535))
    .default(4180),
  JOBYSSEY_DATA_DIR: z
    .string()
    .min(1)
    .default(join(homedir(), ".jobyssey", "data")),
  DATABASE_URL: z.url().optional(),
  ALLOWED_HOSTS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((host) => host.trim().toLowerCase())
        .filter((host) => host !== "")
    ),
  JOBYSSEY_ALLOW_REMOTE: z
    .string()
    .optional()
    .transform((value) => value === "1"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});

export type Config = z.output<typeof schema>;

export function loadConfig(env: Record<string, string | undefined>): Config {
  const result = schema.safeParse(env);
  if (!result.success) throw new ConfigError(z.prettifyError(result.error));
  const config = result.data;
  if (!LOOPBACK.has(config.HOST) && !config.JOBYSSEY_ALLOW_REMOTE)
    throw new ConfigError(
      `Jobyssey has no login, so listening on ${config.HOST} would expose your data to the network. Set JOBYSSEY_ALLOW_REMOTE=1 to do it anyway.`
    );
  return config;
}
