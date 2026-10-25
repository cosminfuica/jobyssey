import type { WebFeature } from "@jobyssey/web-shell/client";
import { systemWebFeature } from "@jobyssey/system/client";
import { systemPaths } from "@jobyssey/system/shared";
// gen:imports

export const coreWebFeatures: readonly WebFeature[] = [
  systemWebFeature,
  // gen:entries
];

export const coreHome = systemPaths.status;
