import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Cluster } from "../types";
import { Panel, Skeleton, HealthBadge, EmptyState, ErrorState } from "../components/ui";

async function fetchClusters(): Promise<Cluster[]> {
  const res = await api.get("/clusters");
  return res.data.data;
}

const STATUS_DOT: Record<string, string> = {
  healthy: "bg-[#3ecf8e]",
  degraded: "bg-[#f5a623]",
  unreachable: "bg-[#ef4444]",
};

export function ClustersPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["clusters"],
    queryFn: fetchClusters,
    refetchInterval: 8000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }
  if (isError) return <ErrorState message="Could not load clusters." />;
  if (!data || data.length === 0) return <EmptyState title="No clusters registered yet" />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Clusters</h1>
        <p className="text-sm text-slate-500">All registered Kubernetes clusters across your cloud fleet.</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {data.map((c) => (
          <Link key={c._id} to={`/clusters/${c._id}`}>
            <Panel>
              <div className="mb-2 flex items-center justify-between">
                <span className={`h-2 w-2 rounded-full ${STATUS_DOT[c.status]}`} />
                <span className="text-xs uppercase tracking-wide text-slate-500">{c.provider}</span>
              </div>
              <p className="text-base font-semibold text-slate-100">{c.name}</p>
              <p className="mb-3 text-xs text-slate-500 capitalize">
                {c.environment} · {c.region}
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{c.nodeCount} nodes</span>
                <HealthBadge score={c.clusterHealthScore} />
              </div>
            </Panel>
          </Link>
        ))}
      </div>
    </div>
  );
}
