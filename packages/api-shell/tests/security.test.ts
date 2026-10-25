import type { AccountId } from "@jobyssey/accounts";
import type { AuthAdapter } from "@jobyssey/auth";
import { Hono } from "hono";
import { pino } from "pino";
import { expect, test } from "vitest";
import type { Feature, FeatureEnv } from "../index.ts";
import { createApp } from "../server.ts";

const auth: AuthAdapter = {
  name: "fake",
  resolveAccount: () => Promise.resolve("acc-1" as AccountId),
};

const probe: Feature = {
  name: "probe",
  routes: new Hono<FeatureEnv>()
    .get("/whoami", (c) => c.json({ accountId: c.get("accountId") }))
    .post("/echo", async (c) => c.json(await c.req.json())),
};

const app = createApp({
  allowedHosts: new Set(["127.0.0.1:4180", "localhost:4180", "[::1]:4180"]),
  auth,
  features: [probe],
  logger: pino({ level: "silent" }),
});

const HOST = "127.0.0.1:4180";

function postJson(headers: Record<string, string>) {
  const body = JSON.stringify({ hello: "world" });
  return app.request("http://127.0.0.1:4180/api/probe/echo", {
    method: "POST",
    body,
    headers: {
      Host: HOST,
      "Content-Type": "application/json",
      "Content-Length": String(body.length),
      ...headers,
    },
  });
}

function expectNoCors(res: Response) {
  expect(res.headers.get("access-control-allow-origin")).toBeNull();
}

test("a foreign Host is refused", async () => {
  const res = await app.request("http://127.0.0.1:4180/api/probe/whoami", {
    headers: { Host: "evil.example:4180" },
  });
  expect(res.status).toBe(403);
  expect(res.headers.get("content-type")).toBe("application/problem+json");
  expectNoCors(res);
});

test("a request without Host is refused", async () => {
  const res = await app.request("http://127.0.0.1:4180/api/probe/whoami");
  expect(res.status).toBe(403);
});

test.each(["127.0.0.1:4180", "LOCALHOST:4180", "[::1]:4180"])(
  "GET with Host %s reaches the feature with the account",
  async (host) => {
    const res = await app.request("http://127.0.0.1:4180/api/probe/whoami", {
      headers: { Host: host },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accountId: "acc-1" });
    expectNoCors(res);
  }
);

test("POST JSON with a foreign Origin is refused", async () => {
  const res = await postJson({ Origin: "http://evil.example" });
  expect(res.status).toBe(403);
  expectNoCors(res);
});

test("POST JSON with Sec-Fetch-Site: cross-site is refused", async () => {
  const res = await postJson({ "Sec-Fetch-Site": "cross-site" });
  expect(res.status).toBe(403);
  expectNoCors(res);
});

test("POST with Origin: null is refused", async () => {
  const res = await postJson({ Origin: "null" });
  expect(res.status).toBe(403);
  expectNoCors(res);
});

test("POST with a text/plain body is refused", async () => {
  const res = await app.request("http://127.0.0.1:4180/api/probe/echo", {
    method: "POST",
    body: "hello",
    headers: {
      Host: HOST,
      "Content-Type": "text/plain",
      "Content-Length": "5",
    },
  });
  expect(res.status).toBe(415);
  expect(res.headers.get("content-type")).toBe("application/problem+json");
  expectNoCors(res);
});

test("POST JSON from the same origin passes", async () => {
  const res = await postJson({
    "Sec-Fetch-Site": "same-origin",
    Origin: "http://127.0.0.1:4180",
  });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ hello: "world" });
  expectNoCors(res);
});

test("POST JSON with neither header passes (curl, scripts)", async () => {
  const res = await postJson({});
  expect(res.status).toBe(200);
  expectNoCors(res);
});
