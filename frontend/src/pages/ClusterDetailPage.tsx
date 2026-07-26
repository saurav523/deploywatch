import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { Cluster, Deployment } from "../types";
import { Panel, Skeleton, HealthBadge, EmptyState, ErrorState } from "../components/ui";

async function fetchCluster(id: string): Promise<Cluster> {
  const res = await api.get(`/clusters/${id}`);
  return res.data.data;
}

async function fetchDeployments(clusterId: string): Promise<Deployment[]> {
  const res = await api.get(`/clusters/${clusterId}/deployments`, { params: { pageSize: 100 } });
  return res.data.data;
}

export function ClusterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [namespaceFilter, setNamespaceFilter] = useState<string>("all");

  const clusterQuery = useQuery({
    queryKey: ["cluster", id],
    queryFn: () => fetchCluster(id!),
    enabled: !!id,
    refetchInterval: 8000,
  });

  const deploymentsQuery = useQuery({
    queryKey: ["deployments", id],
    queryFn: () => fetchDeployments(id!),
    enabled: !!id,
    refetchInterval: 6000,
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["cluster", id] });
      queryClient.invalidateQueries({ queryKey: ["deployments", id] });
    };
    socket.on("deployment:status-change", invalidate);
    socket.on("cluster:health-update", invalidate);
    return () => {
      socket.off("deployment:status-change", invalidate);
      socket.off("cluster:health-update", invalidate);
    };
  }, [id, queryClient]);

  if (clusterQuery.isLoading || deploymentsQuery.isLoading) {
    return <Skeleton className="h-64" />;
  }
  if (clusterQuery.isError || !clusterQuery.data) return <ErrorState message="Cluster not found." />;

  const cluster = clusterQuery.data;
  const deployments = deploymentsQuery.data ?? [];
  const namespaces = Array.from(new Set(deployments.map((d) => d.namespace)));
  const filtered =
    namespaceFilter === "all" ? deployments : deployments.filter((d) => d.namespace === namespaceFilter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">{cluster.name}</h1>
        <p className="text-sm text-slate-500 capitalize">
          {cluster.provider} · {cluster.region} · {cluster.environment}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Panel title="Cluster Health">
          <div className="text-2xl font-bold">
            <HealthBadge score={cluster.clusterHealthScore} />
          </div>
        </Panel>
        <Panel title="Status">
          <p className="text-lg font-semibold capitalize text-slate-100">{cluster.status}</p>
        </Panel>
        <Panel title="Nodes">
          <p className="text-2xl font-bold text-slate-100">{cluster.nodeCount}</p>
        </Panel>
        <Panel title="Namespaces">
          <p className="text-2xl font-bold text-slate-100">{cluster.namespaceCount}</p>
        </Panel>
      </div>

      <Panel
        title="Deployments"
        action={
          <select
            value={namespaceFilter}
            onChange={(e) => setNamespaceFilter(e.target.value)}
            className="rounded-md border border-[#1f2731] bg-[#0b0f14] px-2 py-1 text-xs text-slate-300"
          >
            <option value="all">All namespaces</option>
            {namespaces.map((ns) => (
              <option key={ns} value={ns}>
                {ns}
              </option>
            ))}
          </select>
        }
      >
        {filtered.length === 0 ? (
          <EmptyState title="No deployments in this namespace" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Namespace</th>
                <th className="pb-2 font-medium">Image</th>
                <th className="pb-2 font-medium">Replicas</th>
                <th className="pb-2 font-medium">Health</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d._id} className="border-t border-[#1f2731]">
                  <td className="py-2">
                    <Link to={`/deployments/${d._id}`} className="text-slate-200 hover:text-[#3ecf8e]">
                      {d.name}
                    </Link>
                  </td>
                  <td className="py-2 text-slate-500">{d.namespace}</td>
                  <td className="py-2 text-xs text-slate-500">{d.image}</td>
                  <td className="py-2 tabular-nums text-slate-400">
                    {d.replicas.available}/{d.replicas.desired}
                  </td>
                  <td className="py-2">
                    <HealthBadge score={d.healthScore} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
