export const featureName = "system" as const;

// The page path carries the feature name, so feature pages never collide.
export const systemPaths = { status: "/system" } as const;

export type SystemStatus = {
  name: "Jobyssey";
  version: string;
  node: string;
  database: { driver: "pglite" | "postgres" };
  accountId: string;
};
