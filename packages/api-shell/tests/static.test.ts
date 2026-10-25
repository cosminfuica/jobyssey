import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AccountId } from "@jobyssey/accounts";
import { pino } from "pino";
import { afterAll, expect, test } from "vitest";
import { createApp } from "../server.ts";

const webDist = mkdtempSync(join(tmpdir(), "jby-web-"));
mkdirSync(join(webDist, "assets"));
writeFileSync(join(webDist, "index.html"), "<!doctype html><p>app</p>");
writeFileSync(join(webDist, "assets", "app.js"), "console.log('app');");
afterAll(() => rmSync(webDist, { recursive: true, force: true }));

const app = createApp({
  allowedHosts: new Set(["127.0.0.1:4180"]),
  auth: {
    name: "fake",
    resolveAccount: () => Promise.resolve("acc-1" as AccountId),
  },
  features: [],
  logger: pino({ level: "silent" }),
  webDist,
});

const get = (path: string) =>
  app.request(`http://127.0.0.1:4180${path}`, {
    headers: { Host: "127.0.0.1:4180" },
  });

test.each(["/", "/status"])("%s returns the index HTML", async (path) => {
  const res = await get(path);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toMatch(/^text\/html/);
  expect(await res.text()).toBe("<!doctype html><p>app</p>");
});

test("/assets/app.js returns the script", async () => {
  const res = await get("/assets/app.js");
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toMatch(/^text\/javascript/);
  expect(await res.text()).toBe("console.log('app');");
});

test("/api/unknown returns the 404 problem, not HTML", async () => {
  const res = await get("/api/unknown");
  expect(res.status).toBe(404);
  expect(res.headers.get("content-type")).toBe("application/problem+json");
});
