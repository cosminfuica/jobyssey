import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@jobyssey/ui/components/card";
import type { WebFeature } from "@jobyssey/web-shell/client";
import { useQuery } from "@tanstack/react-query";
import { createRoute } from "@tanstack/react-router";
import { hc } from "hono/client";
import type { SystemRoutes } from "./server.ts";
import { featureName, systemPaths } from "./shared.ts";
import type { SystemStatus } from "./shared.ts";

const client = hc<SystemRoutes>(`/api/${featureName}`);

function useSystemStatus() {
  return useQuery({
    queryKey: [featureName, "status"],
    queryFn: async () => {
      const res = await client.status.$get();
      if (!res.ok) throw new Error(`Status request failed (${res.status})`);
      return res.json();
    },
  });
}

function StatusDetails({ status }: { status: SystemStatus }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1">
      <dt className="text-muted-foreground">Version</dt>
      <dd>{status.version}</dd>
      <dt className="text-muted-foreground">Node</dt>
      <dd>{status.node}</dd>
      <dt className="text-muted-foreground">Database driver</dt>
      <dd>{status.database.driver}</dd>
      <dt className="text-muted-foreground">Account id</dt>
      <dd>{status.accountId}</dd>
    </dl>
  );
}

function StatusBody() {
  const status = useSystemStatus();
  if (status.isPending) return <p>Loading status...</p>;
  if (status.isError)
    return <p role="alert">Could not load status: {status.error.message}</p>;
  return <StatusDetails status={status.data} />;
}

function StatusPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System status</CardTitle>
      </CardHeader>
      <CardContent>
        <StatusBody />
      </CardContent>
    </Card>
  );
}

export const systemWebFeature: WebFeature = {
  name: featureName,
  nav: { label: "System", to: systemPaths.status },
  route: (parent) =>
    createRoute({
      getParentRoute: () => parent,
      path: systemPaths.status,
      component: StatusPage,
    }),
};
