import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { Deployment, Pod } from "../types";
import { Panel, Skeleton, HealthBadge, EmptyState, ErrorState } from "../components/ui";

async function fetchDeployment(id: string): Promise<Deployment> {
  const res = await api.get(`/deployments/${id}`);
  return res.data.data;
}
async function fetchPods(id: string): Promise<Pod[]> {
  const res = await api.get(`/deployments/${id}/pods`);
  return res.data.data;
}
async function fetchTimeline(id: string) {
  const res = await api.get(`/deployments/${id}/timeline`);
  return res.data.data as { score: number; recordedAt: string }[];
}
async function fetchLogs(podId: string) {
  const res = await api.get(`/pods/${podId}/logs`);
  return res.data.data as { podName: string; lines: string[] };
}

const PHASE_COLOR: Record<string, string> = {
  Running: "text-[#3ecf8e]",
  Pending: "text-[#f5a623]",
  CrashLoopBackOff: "text-[#ef4444]",
  ImagePullBackOff: "text-[#ef4444]",
  Failed: "text-[#ef4444]",
};

export function DeploymentDetailPage() {
  const { depId } = useParams<{ depId: string }>();
  const queryClient = useQueryClient();
  const [selectedPod, setSelectedPod] = useState<string | null>(null);

  const depQuery = useQuery({
    queryKey: ["deployment", depId],
    queryFn: () => fetchDeployment(depId!),
    enabled: !!depId,
    refetchInterval: 6000,
  });
  const podsQuery = useQuery({
    queryKey: ["deployment-pods", depId],
    queryFn: () => fetchPods(depId!),
    enabled: !!depId,
    refetchInterval: 5000,
  });
  const timelineQuery = useQuery({
    queryKey: ["deployment-timeline", depId],
    queryFn: () => fetchTimeline(depId!),
    enabled: !!depId,
    refetchInterval: 8000,
  });
  const logsQuery = useQuery({
    queryKey: ["pod-logs", selectedPod],
    queryFn: () => fetchLogs(selectedPod!),
    enabled: !!selectedPod,
    refetchInterval: 4000,
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["deployment", depId] });
      queryClient.invalidateQueries({ queryKey: ["deployment-pods", depId] });
      queryClient.invalidateQueries({ queryKey: ["deployment-timeline", depId] });
    };
    socket.on("deployment:status-change", invalidate);
    return () => {
      socket.off("deployment:status-change", invalidate);
    };
  }, [depId, queryClient]);

  if (depQuery.isLoading) return <Skeleton className="h-64" />;
  if (depQuery.isError || !depQuery.data) return <ErrorState message="Deployment not found." />;

  const dep = depQuery.data;
  const pods = podsQuery.data ?? [];
  const timeline = (timelineQuery.data ?? []).map((t) => ({
    time: new Date(t.recordedAt).toLocaleTimeString(),
    score: t.score,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">{dep.name}</h1>
        <p className="text-sm text-slate-500">{dep.namespace} · {dep.image}</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Panel title="Health Score">
          <div className="text-2xl font-bold"><HealthBadge score={dep.healthScore} /></div>
        </Panel>
        <Panel title="Status">
          <p className="text-lg font-semibold capitalize text-slate-100">{dep.status}</p>
        </Panel>
        <Panel title="Replicas">
          <p className="text-2xl font-bold text-slate-100">
            {dep.replicas.available}/{dep.replicas.desired}
          </p>
        </Panel>
        <Panel title="Unavailable">
          <p className={`text-2xl font-bold ${dep.replicas.unavailable > 0 ? "text-[#ef4444]" : "text-slate-100"}`}>
            {dep.replicas.unavailable}
          </p>
        </Panel>
      </div>

      <Panel title="Why the score is what it is">
        <ul className="space-y-1 text-sm text-slate-300">
          {dep.healthReasons.map((r, i) => (
            <li key={i}>· {r}</li>
          ))}
        </ul>
      </Panel>

      <Panel title="Health Score — Last 200 Samples">
        {timeline.length < 2 ? (
          <EmptyState title="Not enough history yet" subtitle="Health samples accumulate as the simulator ticks." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2731" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#64748b" }} hide />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#64748b" }} />
              <Tooltip contentStyle={{ background: "#11161d", border: "1px solid #1f2731" }} />
              <Line type="monotone" dataKey="score" stroke="#3ecf8e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <div className="grid grid-cols-2 gap-4">
        <Panel title="Pods">
          {pods.length === 0 ? (
            <EmptyState title="No pods found" />
          ) : (
            <div className="space-y-1">
              {pods.map((p) => (
                <button
                  key={p._id}
                  onClick={() => setSelectedPod(p._id)}
                  className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-[#161c25] ${
                    selectedPod === p._id ? "bg-[#161c25]" : ""
                  }`}
                >
                  <div>
                    <p className="text-sm text-slate-200">{p.name}</p>
                    <p className="text-xs text-slate-500">restarts: {p.restartCount}</p>
                  </div>
                  <span className={`text-xs font-medium ${PHASE_COLOR[p.phase] ?? "text-slate-400"}`}>
                    {p.phase}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={selectedPod ? `Logs — ${logsQuery.data?.podName ?? "…"}` : "Logs"}>
          {!selectedPod ? (
            <EmptyState title="Select a pod to view logs" />
          ) : logsQuery.isLoading ? (
            <Skeleton className="h-48" />
          ) : (
            <div className="h-48 overflow-y-auto rounded-md bg-[#0b0f14] p-2 font-mono text-xs text-slate-400">
              {logsQuery.data?.lines.map((line, i) => (
                <p key={i} className={line.includes("ERROR") ? "text-[#ef4444]" : ""}>
                  {line}
                </p>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
