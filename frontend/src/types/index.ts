export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  orgId: string;
}

export interface Cluster {
  _id: string;
  name: string;
  provider: "eks" | "aks" | "gke" | "onprem";
  region: string;
  environment: "production" | "staging" | "qa" | "development";
  status: "healthy" | "degraded" | "unreachable";
  clusterHealthScore: number;
  nodeCount: number;
  namespaceCount: number;
  lastSyncedAt: string;
}

export interface Deployment {
  _id: string;
  clusterId: string;
  namespace: string;
  name: string;
  image: string;
  replicas: { desired: number; ready: number; available: number; unavailable: number };
  healthScore: number;
  healthReasons: string[];
  status: "healthy" | "degraded" | "failing";
  updatedAt: string;
}

export interface Pod {
  _id: string;
  deploymentId: string;
  namespace: string;
  name: string;
  phase: string;
  restartCount: number;
  ready: boolean;
  resourceUsage: { cpuPercent: number; memoryPercent: number };
  lastReason?: string;
}

export interface Incident {
  _id: string;
  clusterId: string;
  resourceName: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "acknowledged" | "resolved";
  rootCause: {
    possibleCauses: { cause: string; probability: number }[];
    affectedServices: string[];
    suggestedRemediation: string[];
    confidenceScore: number;
  };
  timeline: { ts: string; description: string }[];
  openedAt: string;
  resolvedAt?: string;
}

export interface DashboardSummary {
  avgClusterHealth: number;
  clusterCount: number;
  podCount: number;
  openIncidentCount: number;
  clusters: Cluster[];
  worstDeployments: Deployment[];
  criticalIncidents: Incident[];
}
