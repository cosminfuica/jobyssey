import type { Feature, FeatureDeps } from "@jobyssey/api-shell";
import { systemFeature } from "@jobyssey/system/server";
// gen:imports

export function createCoreFeatures(deps: FeatureDeps): Feature[] {
  return [
    systemFeature(deps),
    // gen:entries
  ];
}
