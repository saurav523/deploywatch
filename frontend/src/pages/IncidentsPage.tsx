import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { Incident } from "../types";
import { Panel, Skeleton, SeverityBadge, EmptyState, ErrorState } from "../components/ui";

async function fetchIncidents(status: string): Promise<Incident[]> {
  const res = await api.get("/incidents", { params: status === "all" ? {} : { status } });
  return res.data.data;
}

export function IncidentsPage() {
  const [statusFilter, setStatusFilter] = useState("open");
  const [selected, setSelected] = useState<Incident | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["incidents", statusFilter],
    queryFn: () => fetchIncidents(statusFilter),
    refetchInterval: 5000,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/incidents/${id}`, { status: "acknowledged" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["incidents"] }),
  });
  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/incidents/${id}`, { status: "resolved" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      setSelected(null);
    },
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["incidents"] });
    socket.on("incident:new", invalidate);
    socket.on("incident:resolved", invalidate);
    return () => {
      socket.off("incident:new", invalidate);
      socket.off("incident:resolved", invalidate);
    };
  }, [queryClient]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Incidents</h1>
          <p className="text-sm text-slate-500">Auto-detected failures with root-cause analysis.</p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-[#1f2731] bg-[#0b0f14] px-2 py-1 text-xs text-slate-300"
        >
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
          <option value="all">All</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1 space-y-2">
          {isLoading ? (
            <Skeleton className="h-64" />
          ) : isError ? (
            <ErrorState message="Could not load incidents." />
          ) : !data || data.length === 0 ? (
            <EmptyState title="No incidents" subtitle="Nothing matches this filter." />
          ) : (
            data.map((inc) => (
              <button
                key={inc._id}
                onClick={() => setSelected(inc)}
                className={`card w-full text-left transition-colors hover:border-[#3ecf8e]/40 ${
                  selected?._id === inc._id ? "border-[#3ecf8e]/60" : ""
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-200">{inc.resourceName}</p>
                  <SeverityBadge severity={inc.severity} />
                </div>
                <p className="text-xs text-slate-500">{inc.type}</p>
                <p className="mt-1 text-xs text-slate-600">{new Date(inc.openedAt).toLocaleString()}</p>
              </button>
            ))
          )}
        </div>

        <div className="col-span-2">
          {!selected ? (
            <Panel>
              <EmptyState title="Select an incident" subtitle="Root-cause analysis appears here." />
            </Panel>
          ) : (
            <Panel
              title={`${selected.type} — ${selected.resourceName}`}
              action={
                <div className="flex gap-2">
                  {selected.status === "open" && (
                    <button
                      onClick={() => acknowledgeMutation.mutate(selected._id)}
                      className="rounded-md border border-[#1f2731] px-2 py-1 text-xs text-slate-300 hover:border-slate-500"
                    >
                      Acknowledge
                    </button>
                  )}
                  {selected.status !== "resolved" && (
                    <button
                      onClick={() => resolveMutation.mutate(selected._id)}
                      className="rounded-md bg-[#3ecf8e] px-2 py-1 text-xs font-medium text-[#0b0f14]"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              }
            >
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={selected.severity} />
                  <span className="text-xs text-slate-500 capitalize">{selected.status}</span>
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Possible Causes</p>
                  <div className="space-y-1">
                    {selected.rootCause.possibleCauses.map((c, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-slate-300">{c.cause}</span>
                        <span className="text-xs tabular-nums text-slate-500">
                          {Math.round(c.probability * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Suggested Remediation</p>
                  <ul className="space-y-1">
                    {selected.rootCause.suggestedRemediation.map((r, i) => (
                      <li key={i} className="text-slate-300">· {r}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Timeline</p>
                  <div className="space-y-1 border-l border-[#1f2731] pl-3">
                    {selected.timeline.map((t, i) => (
                      <div key={i}>
                        <p className="text-xs text-slate-500">{new Date(t.ts).toLocaleString()}</p>
                        <p className="text-sm text-slate-300">{t.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
