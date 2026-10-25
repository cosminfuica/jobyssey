import type { AccountId } from "@jobyssey/accounts";
import type { AuthAdapter } from "@jobyssey/auth";
import { Hono } from "hono";
import { pino } from "pino";
import { expect, test } from "vitest";
import type { Feature, FeatureEnv } from "../index.ts";
import { createApp } from "../server.ts";

const logger = pino({ level: "silent" });
const allowedHosts = new Set(["127.0.0.1:4180"]);

function feature(name: string): Feature {
  return { name, routes: new Hono<FeatureEnv>().get("/", (c) => c.text(name)) };
}

function fakeAuth(): AuthAdapter & { calls: number } {
  const adapter = {
    name: "fake",
    calls: 0,
    resolveAccount: () => {
      adapter.calls++;
      return Promise.resolve("acc-1" as AccountId);
    },
  };
  return adapter;
}

test("two features with the same name are rejected", () => {
  expect(() =>
    createApp({
      allowedHosts,
      auth: fakeAuth(),
      features: [feature("probe"), feature("probe")],
      logger,
    })
  ).toThrow('Feature "probe" is mounted twice; feature names must be unique');
});

test("a feature named auth is rejected", () => {
  expect(() =>
    createApp({
      allowedHosts,
      auth: fakeAuth(),
      features: [feature("auth")],
      logger,
    })
  ).toThrow('Feature name "auth" is reserved');
});

test("adapter routes answer at /api/auth without resolving an account", async () => {
  const auth = {
    ...fakeAuth(),
    routes: new Hono().get("/ping", (c) => c.text("pong")),
  };
  const app = createApp({
    allowedHosts,
    auth,
    features: [feature("probe")],
    logger,
  });
  const res = await app.request("http://127.0.0.1:4180/api/auth/ping", {
    headers: { Host: "127.0.0.1:4180" },
  });
  expect(res.status).toBe(200);
  expect(await res.text()).toBe("pong");
  expect(auth.calls).toBe(0);
});
