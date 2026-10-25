import { expect, test } from "vitest";
import { listeningUrl, logMessage, parseSmokeArgs } from "./smoke.ts";

test("arguments default to the core API and the web dist", () => {
  expect(parseSmokeArgs([])).toEqual({
    api: "apps/api/src/main.ts",
    dist: "apps/web/dist",
  });
  expect(parseSmokeArgs(["--api", "x/main.ts", "--dist", "y"])).toEqual({
    api: "x/main.ts",
    dist: "y",
  });
});

test("the line parser reads pino JSON msg and passes plain text through", () => {
  expect(
    logMessage(
      '{"level":30,"time":1,"msg":"Jobyssey listening on http://127.0.0.1:4180"}'
    )
  ).toBe("Jobyssey listening on http://127.0.0.1:4180");
  expect(logMessage("INFO: plain line")).toBe("INFO: plain line");
  expect(logMessage('{"level":30}')).toBe('{"level":30}');
  expect(logMessage("not { json")).toBe("not { json");
});

test("the URL is extracted from the listening line only", () => {
  expect(listeningUrl("Jobyssey listening on http://127.0.0.1:41234")).toBe(
    "http://127.0.0.1:41234"
  );
  expect(listeningUrl("Jobyssey listening on http://[::1]:4180")).toBe(
    "http://[::1]:4180"
  );
  expect(listeningUrl("migrations done")).toBeUndefined();
});
