import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "root",
          include: ["scripts/**/*.test.ts", "tests/**/*.test.ts"],
          exclude: ["**/fixtures/**"],
        },
      },
    ],
  },
});
