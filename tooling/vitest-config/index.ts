import { defineConfig } from "vitest/config";

export function createVitestConfig(options?: { integration?: boolean }) {
  const integration = options?.integration ?? true;
  return defineConfig({
    test: {
      passWithNoTests: false,
      projects: [
        {
          test: {
            name: "unit",
            include: ["tests/**/*.test.{ts,tsx}"],
            exclude: ["**/*.integration.test.{ts,tsx}"],
          },
        },
        ...(integration
          ? [
              {
                test: {
                  name: "integration-pglite",
                  include: ["tests/**/*.integration.test.{ts,tsx}"],
                  env: { TEST_DB: "pglite" },
                  fileParallelism: false,
                },
              },
              ...(process.env.TEST_DATABASE_URL
                ? [
                    {
                      test: {
                        name: "integration-postgres",
                        include: ["tests/**/*.integration.test.{ts,tsx}"],
                        env: {
                          TEST_DB: "postgres",
                          DATABASE_URL: process.env.TEST_DATABASE_URL,
                        },
                        fileParallelism: false,
                      },
                    },
                  ]
                : []),
            ]
          : []),
      ],
    },
  });
}
