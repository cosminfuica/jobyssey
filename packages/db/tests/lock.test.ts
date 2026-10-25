import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { acquireDataDirLock, DataDirLockedError } from "../index.ts";

const dirs: string[] = [];
const releases: (() => void)[] = [];
afterEach(() => {
  for (const release of releases.splice(0)) release();
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "jby-lock-"));
  dirs.push(dir);
  return dir;
}

function acquire(dir: string): () => void {
  const release = acquireDataDirLock(dir);
  releases.push(release);
  return release;
}

test("the first acquire creates the lock file with our PID", () => {
  const dir = tempDir();
  acquire(dir);
  expect(readFileSync(join(dir, "jobyssey.lock"), "utf8")).toBe(
    String(process.pid)
  );
});

test("a second acquire of the same folder in this process throws", () => {
  const dir = tempDir();
  acquire(dir);
  expect(() => acquireDataDirLock(dir)).toThrow(DataDirLockedError);
  expect(() => acquireDataDirLock(dir)).toThrow(
    `This process already holds ${dir}.`
  );
});

test("a lock held by a live process throws", async () => {
  const dir = tempDir();
  const child = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
    stdio: "ignore",
  });
  try {
    await once(child, "spawn");
    writeFileSync(join(dir, "jobyssey.lock"), String(child.pid));
    expect(() => acquireDataDirLock(dir)).toThrow(
      new DataDirLockedError(
        `Another Jobyssey process (pid ${child.pid}) is using ${dir}. Stop it first.`
      )
    );
  } finally {
    const exited = once(child, "exit");
    child.kill();
    await exited;
  }
});

test("a lock left by a dead process is taken over", async () => {
  const dir = tempDir();
  const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
  await once(child, "exit");
  writeFileSync(join(dir, "jobyssey.lock"), String(child.pid));
  acquire(dir);
  expect(readFileSync(join(dir, "jobyssey.lock"), "utf8")).toBe(
    String(process.pid)
  );
});

test("release removes the file and a second release is a no-op", () => {
  const dir = tempDir();
  const release = acquireDataDirLock(dir);
  release();
  expect(existsSync(join(dir, "jobyssey.lock"))).toBe(false);
  expect(() => release()).not.toThrow();
  // The folder is free again for this process.
  acquire(dir);
});
