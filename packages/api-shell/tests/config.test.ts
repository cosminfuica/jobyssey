import { homedir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { ConfigError } from "../index.ts";
import { loadConfig } from "../server.ts";

test("defaults", () => {
  expect(loadConfig({})).toEqual({
    HOST: "127.0.0.1",
    PORT: 4180,
    JOBYSSEY_DATA_DIR: join(homedir(), ".jobyssey", "data"),
    ALLOWED_HOSTS: [],
    JOBYSSEY_ALLOW_REMOTE: false,
    LOG_LEVEL: "info",
  });
});

test("ALLOWED_HOSTS is split on commas", () => {
  expect(
    loadConfig({ ALLOWED_HOSTS: "jobs.example:8080, Box.Local:4180," })
      .ALLOWED_HOSTS
  ).toEqual(["jobs.example:8080", "box.local:4180"]);
});

test.each(["abc", "70000", "-1", "4.5", ""])("invalid PORT %j", (port) => {
  expect(() => loadConfig({ PORT: port })).toThrow(ConfigError);
  expect(() => loadConfig({ PORT: port })).toThrow(/PORT/);
});

test("PORT 0 is accepted (any free port)", () => {
  expect(loadConfig({ PORT: "0" }).PORT).toBe(0);
});

test("invalid DATABASE_URL", () => {
  expect(() => loadConfig({ DATABASE_URL: "not a url" })).toThrow(ConfigError);
  expect(() => loadConfig({ DATABASE_URL: "not a url" })).toThrow(
    /DATABASE_URL/
  );
});

test("every issue is listed", () => {
  expect(() => loadConfig({ PORT: "x", LOG_LEVEL: "loud" })).toThrow(
    /PORT[\s\S]*LOG_LEVEL|LOG_LEVEL[\s\S]*PORT/
  );
});

test("HOST 0.0.0.0 without JOBYSSEY_ALLOW_REMOTE is refused", () => {
  expect(() => loadConfig({ HOST: "0.0.0.0" })).toThrow(
    new ConfigError(
      "Jobyssey has no login, so listening on 0.0.0.0 would expose your data to the network. Set JOBYSSEY_ALLOW_REMOTE=1 to do it anyway."
    )
  );
});

test("HOST 0.0.0.0 with JOBYSSEY_ALLOW_REMOTE=1 is accepted", () => {
  expect(
    loadConfig({ HOST: "0.0.0.0", JOBYSSEY_ALLOW_REMOTE: "1" })
  ).toMatchObject({ HOST: "0.0.0.0", JOBYSSEY_ALLOW_REMOTE: true });
});

test.each(["::1", "localhost"])("loopback HOST %s needs no opt-in", (host) => {
  expect(loadConfig({ HOST: host }).HOST).toBe(host);
});
