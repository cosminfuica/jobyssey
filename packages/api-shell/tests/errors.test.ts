import type { AccountId } from "@jobyssey/accounts";
import { Hono } from "hono";
import { pino } from "pino";
import { expect, test } from "vitest";
import type { FeatureEnv } from "../index.ts";
import { createApp } from "../server.ts";

const app = createApp({
  allowedHosts: new Set(["127.0.0.1:4180"]),
  auth: {
    name: "fake",
    resolveAccount: () => Promise.resolve("acc-1" as AccountId),
  },
  features: [
    {
      name: "boom",
      routes: new Hono<FeatureEnv>().get("/", () => {
        throw new Error("secret internal detail");
      }),
    },
  ],
  logger: pino({ level: "silent" }),
});

const get = (path: string) =>
  app.request(`http://127.0.0.1:4180${path}`, {
    headers: { Host: "127.0.0.1:4180" },
  });

test("an unknown API path is a 404 problem", async () => {
  const res = await get("/api/nope");
  expect(res.status).toBe(404);
  expect(res.headers.get("content-type")).toBe("application/problem+json");
  expect(await res.json()).toEqual({
    type: "about:blank",
    title: "Not Found",
    status: 404,
  });
});

test("a route that throws is a 500 problem without internals", async () => {
  const res = await get("/api/boom");
  expect(res.status).toBe(500);
  expect(res.headers.get("content-type")).toBe("application/problem+json");
  const text = await res.text();
  expect(JSON.parse(text)).toEqual({
    type: "about:blank",
    title: "Internal Server Error",
    status: 500,
  });
  expect(text).not.toContain("secret internal detail");
  expect(text).not.toMatch(/\bat\s.+:\d+/);
});
