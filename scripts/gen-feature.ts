// Generates a feature package from packages/system and registers it.
// Run: pnpm gen:feature <name>
import { join } from "node:path";
import { generateFeature } from "./lib/feature-gen.ts";

const root = join(import.meta.dirname, "..");
const args = process.argv.slice(2);

if (args.length !== 1) {
  console.error("usage: pnpm gen:feature <name>");
  process.exitCode = 1;
} else {
  try {
    const changed = generateFeature(root, args[0] ?? "");
    for (const path of changed) console.log(path);
    console.log("Next: pnpm check");
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}
