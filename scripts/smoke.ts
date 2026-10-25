// Boots a built composition root on a temporary data folder and checks the status endpoint, the page, the SPA fallback, problem JSON and the lock cleanup.
// Run: pnpm smoke [--api apps/api/src/main.ts] [--dist apps/web/dist]
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";

const LISTENING = /Jobyssey listening on (https?:\/\/\S+)/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseSmokeArgs(args: string[]): { api: string; dist: string } {
  const { values } = parseArgs({
    args,
    options: {
      api: { type: "string", default: "apps/api/src/main.ts" },
      dist: { type: "string", default: "apps/web/dist" },
    },
  });
  return { api: values.api, dist: values.dist };
}

// The API logs pino JSON when stdout is a pipe; any other line is taken as plain text.
export function logMessage(line: string): string {
  try {
    const parsed: unknown = JSON.parse(line);
    if (typeof parsed === "object" && parsed !== null && "msg" in parsed)
      return typeof parsed.msg === "string" ? parsed.msg : line;
  } catch {
    // not JSON
  }
  return line;
}

export function listeningUrl(message: string): string | undefined {
  return LISTENING.exec(message)?.[1];
}

function expect(condition: boolean, what: string): void {
  if (!condition) throw new Error(`smoke: ${what}`);
}

async function smoke(api: string, dist: string): Promise<void> {
  if (!existsSync(join(dist, "index.html")))
    throw new Error(`${dist} is missing; run pnpm build first`);
  if (!existsSync(api)) throw new Error(`${api} does not exist`);

  const signal = AbortSignal.timeout(30_000);
  const dataDir = await mkdtemp(join(tmpdir(), "jobyssey-smoke-"));
  const child = spawn(process.execPath, [api], {
    env: {
      ...process.env,
      JOBYSSEY_DATA_DIR: dataDir,
      PORT: "0",
      HOST: "127.0.0.1",
      LOG_LEVEL: "info",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output: string[] = [];
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    output.push(chunk.trimEnd());
  });
  const running = () =>
    child.pid !== undefined &&
    child.exitCode === null &&
    child.signalCode === null;

  try {
    const {
      promise: listening,
      resolve,
      reject,
    } = Promise.withResolvers<string>();
    createInterface({ input: child.stdout }).on("line", (line) => {
      output.push(line);
      const url = listeningUrl(logMessage(line));
      if (url !== undefined) resolve(url);
    });
    child.once("error", reject);
    child.once("exit", (code, exitSignal) => {
      reject(
        new Error(`the API exited (${code ?? exitSignal}) before listening`)
      );
    });
    signal.addEventListener(
      "abort",
      () => {
        reject(new Error("no listening line within 30 s"));
      },
      { once: true }
    );
    const url = await listening;

    const status = await fetch(`${url}/api/system/status`, { signal });
    expect(status.status === 200, `status returned ${status.status}`);
    const body = (await status.json()) as {
      database?: { driver?: unknown };
      accountId?: unknown;
    };
    expect(
      body.database?.driver === "pglite",
      `database.driver is ${JSON.stringify(body.database?.driver)}`
    );
    expect(
      typeof body.accountId === "string" && UUID.test(body.accountId),
      `accountId ${JSON.stringify(body.accountId)} is not a UUID`
    );

    const page = await fetch(`${url}/`, { signal });
    expect(page.status === 200, `/ returned ${page.status}`);
    expect(
      page.headers.get("content-type")?.startsWith("text/html") === true,
      `/ content-type is ${page.headers.get("content-type")}`
    );
    expect(
      (await page.text()).includes('<div id="root">'),
      `/ has no <div id="root">`
    );

    const fallback = await fetch(`${url}/system`, { signal });
    expect(fallback.status === 200, `/system returned ${fallback.status}`);
    expect(
      fallback.headers.get("content-type")?.startsWith("text/html") === true,
      `/system content-type is ${fallback.headers.get("content-type")}`
    );
    await fallback.body?.cancel();

    const missing = await fetch(`${url}/api/nope`, { signal });
    expect(missing.status === 404, `/api/nope returned ${missing.status}`);
    expect(
      missing.headers
        .get("content-type")
        ?.startsWith("application/problem+json") === true,
      `/api/nope content-type is ${missing.headers.get("content-type")}`
    );
    await missing.body?.cancel();

    const exited = once(child, "exit", { signal });
    child.kill("SIGTERM");
    await exited;
    expect(
      !existsSync(join(dataDir, "jobyssey.lock")),
      "jobyssey.lock is still there after SIGTERM"
    );
  } catch (error) {
    console.error(output.join("\n"));
    throw error;
  } finally {
    if (running()) {
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited;
    }
    await rm(dataDir, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  try {
    const { api, dist } = parseSmokeArgs(process.argv.slice(2));
    await smoke(api, dist);
    console.log("smoke: ok");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
