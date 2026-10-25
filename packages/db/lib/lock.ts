import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export class DataDirLockedError extends Error {
  override readonly name = "DataDirLockedError";
}

// Folders this process holds; a second open in the same process fails like one from another process.
const held = new Set<string>();

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException).code;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists but belongs to another user.
    if (errorCode(error) === "EPERM") return true;
    if (errorCode(error) === "ESRCH") return false;
    throw error;
  }
}

export function acquireDataDirLock(dataDir: string): () => void {
  const key = resolve(dataDir);
  if (held.has(key))
    throw new DataDirLockedError(`This process already holds ${dataDir}.`);
  mkdirSync(dataDir, { recursive: true });
  const file = join(dataDir, "jobyssey.lock");
  const pid = String(process.pid);
  try {
    writeFileSync(file, pid, { flag: "wx" });
  } catch (error) {
    if (errorCode(error) !== "EEXIST") throw error;
    const owner = Number(readFileSync(file, "utf8").trim());
    // A file without a valid PID (a crash between create and write) is stale; kill(0) would signal our own process group.
    const valid = Number.isInteger(owner) && owner > 0;
    if (valid && owner !== process.pid && isAlive(owner))
      throw new DataDirLockedError(
        `Another Jobyssey process (pid ${owner}) is using ${dataDir}. Stop it first.`
      );
    // shortcut: taking over a stale file is not atomic, so two processes racing on the same stale lock can both win; fine for one local user, use flock if that changes.
    writeFileSync(file, pid);
  }
  held.add(key);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    held.delete(key);
    try {
      if (readFileSync(file, "utf8") === pid) unlinkSync(file);
    } catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
    }
  };
}
