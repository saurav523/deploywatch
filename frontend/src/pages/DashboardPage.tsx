import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { DashboardSummary } from "../types";
import { Panel, Skeleton, HealthBadge, SeverityBadge, EmptyState, ErrorState } from "../components/ui";

async function fetchSummary(): Promise<DashboardSummary> {
  const res = await api.get("/dashboard/summary");
  return res.data.data;
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: fetchSummary,
    refetchInterval: 8000,
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    socket.on("cluster:health-update", invalidate);
    socket.on("incident:new", invalidate);
    socket.on("incident:resolved", invalidate);
    return () => {
      socket.off("cluster:health-update", invalidate);
      socket.off("incident:new", invalidate);
      socket.off("incident:resolved", invalidate);
    };
  }, [queryClient]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  if (isError || !data) return <ErrorState message="Could not load dashboard summary." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Fleet Overview</h1>
        <p className="text-sm text-slate-500">What needs attention right now, across every cluster.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Panel title="Avg. Cluster Health">
          <div className="text-3xl font-bold">
            <HealthBadge score={data.avgClusterHealth} />
          </div>
        </Panel>
        <Panel title="Clusters">
          <div className="text-3xl font-bold text-slate-100">{data.clusterCount}</div>
        </Panel>
        <Panel title="Pods Tracked">
          <div className="text-3xl font-bold text-slate-100">{data.podCount}</div>
        </Panel>
        <Panel title="Open Incidents">
          <div className={`text-3xl font-bold ${data.openIncidentCount > 0 ? "text-[#ef4444]" : "text-slate-100"}`}>
            {data.openIncidentCount}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Panel title="Clusters by Health">
          {data.clusters.length === 0 ? (
            <EmptyState title="No clusters registered" />
          ) : (
            <div className="space-y-2">
              {data.clusters.map((c) => (
                <Link
                  key={c._id}
                  to={`/clusters/${c._id}`}
                  className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-[#161c25]"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-200">{c.name}</p>
                    <p className="text-xs text-slate-500 uppercase">
                      {c.provider} · {c.environment}
                    </p>
                  </div>
                  <HealthBadge score={c.clusterHealthScore} />
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Critical Incidents">
          {data.criticalIncidents.length === 0 ? (
            <EmptyState title="No critical incidents" subtitle="Fleet is quiet right now." />
          ) : (
            <div className="space-y-2">
              {data.criticalIncidents.map((inc) => (
                <div key={inc._id} className="rounded-lg px-2 py-2 hover:bg-[#161c25]">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-200">{inc.resourceName}</p>
                    <SeverityBadge severity={inc.severity} />
                  </div>
                  <p className="text-xs text-slate-500">{inc.type}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Deployments Needing Attention">
        {data.worstDeployments.length === 0 ? (
          <EmptyState title="No deployment data yet" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="pb-2 font-medium">Deployment</th>
                <th className="pb-2 font-medium">Namespace</th>
                <th className="pb-2 font-medium">Replicas</th>
                <th className="pb-2 font-medium">Health</th>
              </tr>
            </thead>
            <tbody>
              {data.worstDeployments.map((d) => (
                <tr key={d._id} className="border-t border-[#1f2731]">
                  <td className="py-2">
                    <Link to={`/deployments/${d._id}`} className="text-slate-200 hover:text-[#3ecf8e]">
                      {d.name}
                    </Link>
                  </td>
                  <td className="py-2 text-slate-500">{d.namespace}</td>
                  <td className="py-2 text-slate-400 tabular-nums">
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
