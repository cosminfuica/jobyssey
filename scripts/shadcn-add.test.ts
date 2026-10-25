import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, test } from "vitest";
import {
  copyList,
  importedPackages,
  mergeDependencies,
  rewriteAliases,
} from "./shadcn-add.ts";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

test("copies components, hooks and lib files, nothing else", () => {
  const src = mkdtempSync(join(tmpdir(), "jby-shadcn-add-"));
  roots.push(src);
  for (const file of [
    "components/button.tsx",
    "components/card.tsx",
    "components/ui/nested.tsx",
    "components/notes.md",
    "hooks/use-mobile.ts",
    "lib/utils.ts",
    "styles/globals.css",
    "main.tsx",
  ]) {
    mkdirSync(dirname(join(src, file)), { recursive: true });
    writeFileSync(join(src, file), "");
  }
  expect(copyList(src)).toEqual([
    "components/button.tsx",
    "components/card.tsx",
    "hooks/use-mobile.ts",
    "lib/utils.ts",
  ]);
});

test("points the ui alias at the flat components folder", () => {
  const input = JSON.stringify({
    style: "radix-nova",
    aliases: {
      components: "@jobyssey/ui/components",
      ui: "@jobyssey/ui/components/ui",
      utils: "@jobyssey/ui/lib/utils",
    },
  });
  expect(JSON.parse(rewriteAliases(input))).toEqual({
    style: "radix-nova",
    aliases: {
      components: "@jobyssey/ui/components",
      ui: "@jobyssey/ui/components",
      utils: "@jobyssey/ui/lib/utils",
    },
  });
  expect(() => rewriteAliases("{}")).toThrow("no aliases");
});

test("counts only bare runtime specifiers", () => {
  const source = [
    'import * as React from "react";',
    'import { cva, type VariantProps } from "class-variance-authority";',
    'import type { Slot } from "radix-ui";',
    'import "@fontsource-variable/geist/wght.css";',
    'import { helper } from "./helper.tsx";',
    'import { Button } from "@jobyssey/ui/components/button";',
    'import { readFileSync } from "node:fs";',
    'export { cn } from "cn";',
    'export type { Foo } from "type-only-package";',
  ].join("\n");
  expect(importedPackages("components/x.tsx", source)).toEqual([
    "@fontsource-variable/geist",
    "class-variance-authority",
    "cn",
    "react",
  ]);
  const css = [
    '@import "tailwindcss";',
    '@import "shadcn/tailwind.css";',
    '@import "./local.css";',
    "@theme inline {}",
  ].join("\n");
  expect(importedPackages("styles/globals.css", css)).toEqual([
    "shadcn",
    "tailwindcss",
  ]);
});

test("adds new packages to the catalog with the CLI's range", () => {
  const merged = mergeDependencies({
    catalog: { react: "^19.3.1", tailwindcss: "^4.3.3" },
    chosen: { cn: "^0.5.0", react: "^19.0.0", "lucide-react": "^1.61.0" },
    imported: ["cn", "react", "tailwindcss"],
    current: { "radix-ui": "catalog:" },
  });
  expect(merged).toEqual({
    catalogAdditions: { cn: "^0.5.0" },
    dependencies: {
      cn: "catalog:",
      "radix-ui": "catalog:",
      react: "catalog:",
      tailwindcss: "catalog:",
    },
  });
  expect(() =>
    mergeDependencies({
      catalog: {},
      chosen: {},
      imported: ["unknown"],
      current: {},
    })
  ).toThrow("unknown is imported");
});
