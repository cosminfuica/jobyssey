import { createRoute } from "@tanstack/react-router";
import { expect, test } from "vitest";
import { createAppRouter } from "../client.tsx";
import type { WebFeature } from "../client.tsx";

const fake: WebFeature = {
  name: "fake",
  nav: { label: "Fake", to: "/fake" },
  route: (parent) =>
    createRoute({
      getParentRoute: () => parent,
      path: "/fake",
      component: () => null,
    }),
};

test("builds a router without features", () => {
  const router = createAppRouter({ features: [] });
  expect(Object.keys(router.routesByPath)).toEqual(["/"]);
});

test("adds each feature's route to the tree", () => {
  const router = createAppRouter({ features: [fake] });
  expect(Object.keys(router.routesByPath).sort()).toEqual(["/", "/fake"]);
});

test("redirects the index route when home is set", () => {
  const withHome = createAppRouter({ features: [fake], home: "/x" });
  const plain = createAppRouter({ features: [fake] });
  expect(withHome.routesByPath["/"].options.beforeLoad).toBeTypeOf("function");
  expect(plain.routesByPath["/"].options.beforeLoad).toBeUndefined();
});
