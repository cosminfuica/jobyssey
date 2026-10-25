import { Card, CardHeader, CardTitle } from "@jobyssey/ui/components/card";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  redirect,
  RouterProvider,
} from "@tanstack/react-router";
import type { AnyRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

type NavItem = { readonly label: string; readonly to: string };

export type WebFeature = {
  readonly name: string;
  readonly nav?: NavItem;
  readonly route: (parent: AnyRoute) => AnyRoute;
};

function AppShell({
  nav,
  children,
}: {
  nav: readonly NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="flex items-center gap-6 border-b px-6 py-3">
        <span className="font-heading text-lg font-semibold">Jobyssey</span>
        <nav className="flex gap-4 text-sm">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-muted-foreground hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}

function Running() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Jobyssey is running</CardTitle>
      </CardHeader>
    </Card>
  );
}

export function createAppRouter(options: {
  features: readonly WebFeature[];
  home?: string;
}) {
  const { features, home } = options;
  const nav = features.flatMap((feature) =>
    feature.nav === undefined ? [] : [feature.nav]
  );
  const rootRoute = createRootRoute({
    component: () => (
      <AppShell nav={nav}>
        <Outlet />
      </AppShell>
    ),
  });
  const indexRoute =
    home === undefined
      ? createRoute({
          getParentRoute: () => rootRoute,
          path: "/",
          component: Running,
        })
      : createRoute({
          getParentRoute: () => rootRoute,
          path: "/",
          beforeLoad: () => redirect({ to: home, throw: true }),
        });
  const routeTree = rootRoute.addChildren([
    indexRoute,
    ...features.map((feature) => feature.route(rootRoute)),
  ]);
  return createRouter({ routeTree });
}

const queryClient = new QueryClient();

export function AppProviders({
  router,
}: {
  router: ReturnType<typeof createAppRouter>;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
