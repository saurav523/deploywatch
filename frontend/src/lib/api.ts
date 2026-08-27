import axios from "axios";

const DEMO_CLUSTERS = [
  {
    _id: "cluster-1",
    name: "prod-us-east",
    provider: "eks",
    region: "us-east-1",
    environment: "production",
    status: "healthy",
    clusterHealthScore: 96,
    nodeCount: 6,
    namespaceCount: 4,
    lastSyncedAt: new Date().toISOString(),
  },
  {
    _id: "cluster-2",
    name: "prod-eu-west",
    provider: "aks",
    region: "eu-west-1",
    environment: "production",
    status: "healthy",
    clusterHealthScore: 92,
    nodeCount: 6,
    namespaceCount: 4,
    lastSyncedAt: new Date().toISOString(),
  },
  {
    _id: "cluster-3",
    name: "staging-us-east",
    provider: "gke",
    region: "us-east1",
    environment: "staging",
    status: "degraded",
    clusterHealthScore: 78,
    nodeCount: 3,
    namespaceCount: 4,
    lastSyncedAt: new Date().toISOString(),
  },
  {
    _id: "cluster-4",
    name: "dev-cluster",
    provider: "onprem",
    region: "on-prem-dc1",
    environment: "development",
    status: "healthy",
    clusterHealthScore: 88,
    nodeCount: 3,
    namespaceCount: 4,
    lastSyncedAt: new Date().toISOString(),
  },
];

const DEMO_DEPLOYMENTS = [
  {
    _id: "dep-1",
    clusterId: "cluster-1",
    namespace: "payments",
    name: "payments-api",
    image: "registry.internal/payments-api:v1.18.0",
    replicas: {
      desired: 3,
      ready: 3,
      available: 3,
      unavailable: 0,
    },
    healthScore: 98,
    healthReasons: ["All replicas healthy", "No recent restarts"],
    status: "healthy",
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "dep-2",
    clusterId: "cluster-1",
    namespace: "platform",
    name: "checkout-service",
    image: "registry.internal/checkout-service:v1.12.0",
    replicas: {
      desired: 3,
      ready: 3,
      available: 3,
      unavailable: 0,
    },
    healthScore: 94,
    healthReasons: ["Healthy replica availability"],
    status: "healthy",
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "dep-3",
    clusterId: "cluster-1",
    namespace: "default",
    name: "notification-worker",
    image: "registry.internal/notification-worker:v1.7.0",
    replicas: {
      desired: 3,
      ready: 2,
      available: 2,
      unavailable: 1,
    },
    healthScore: 61,
    healthReasons: [
      "One replica unavailable",
      "Restart count increasing",
      "Possible CrashLoopBackOff",
    ],
    status: "degraded",
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "dep-4",
    clusterId: "cluster-2",
    namespace: "payments",
    name: "auth-service",
    image: "registry.internal/auth-service:v2.4.0",
    replicas: {
      desired: 3,
      ready: 3,
      available: 3,
      unavailable: 0,
    },
    healthScore: 97,
    healthReasons: ["All replicas healthy"],
    status: "healthy",
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "dep-5",
    clusterId: "cluster-3",
    namespace: "growth",
    name: "recommendation-engine",
    image: "registry.internal/recommendation-engine:v3.1.0",
    replicas: {
      desired: 2,
      ready: 1,
      available: 1,
      unavailable: 1,
    },
    healthScore: 54,
    healthReasons: [
      "Replica unavailable",
      "Image pull failures detected",
    ],
    status: "failing",
    updatedAt: new Date().toISOString(),
  },
];

const DEMO_PODS = [
  {
    _id: "pod-1",
    deploymentId: "dep-1",
    namespace: "payments",
    name: "payments-api-7f8c9d6b5-x2k9p",
    phase: "Running",
    restartCount: 0,
    ready: true,
    resourceUsage: {
      cpuPercent: 32,
      memoryPercent: 48,
    },
  },
  {
    _id: "pod-2",
    deploymentId: "dep-1",
    namespace: "payments",
    name: "payments-api-7f8c9d6b5-m4n7q",
    phase: "Running",
    restartCount: 1,
    ready: true,
    resourceUsage: {
      cpuPercent: 28,
      memoryPercent: 44,
    },
  },
  {
    _id: "pod-3",
    deploymentId: "dep-3",
    namespace: "default",
    name: "notification-worker-6d7f8b9c4-p8r2k",
    phase: "CrashLoopBackOff",
    restartCount: 14,
    ready: false,
    resourceUsage: {
      cpuPercent: 71,
      memoryPercent: 82,
    },
    lastReason: "Container exited with code 1",
  },
  {
    _id: "pod-4",
    deploymentId: "dep-3",
    namespace: "default",
    name: "notification-worker-6d7f8b9c4-q1m5z",
    phase: "Running",
    restartCount: 2,
    ready: true,
    resourceUsage: {
      cpuPercent: 35,
      memoryPercent: 52,
    },
  },
  {
    _id: "pod-5",
    deploymentId: "dep-5",
    namespace: "growth",
    name: "recommendation-engine-5f6c7d8e9-a2b3c",
    phase: "ImagePullBackOff",
    restartCount: 0,
    ready: false,
    resourceUsage: {
      cpuPercent: 5,
      memoryPercent: 18,
    },
    lastReason: "Failed to pull image",
  },
];

const DEMO_INCIDENTS = [
  {
    _id: "incident-1",
    clusterId: "cluster-1",
    resourceName: "notification-worker",
    type: "CrashLoopBackOff",
    severity: "critical",
    status: "open",
    rootCause: {
      possibleCauses: [
        {
          cause: "Application process exiting unexpectedly",
          probability: 0.72,
        },
        {
          cause: "Invalid environment configuration",
          probability: 0.18,
        },
        {
          cause: "Dependency connection failure",
          probability: 0.1,
        },
      ],
      affectedServices: ["notification-worker"],
      suggestedRemediation: [
        "Inspect recent container logs",
        "Verify environment variables",
        "Rollback to previous stable image",
      ],
      confidenceScore: 0.91,
    },
    timeline: [
      {
        ts: new Date(Date.now() - 25 * 60000).toISOString(),
        description: "Restart count exceeded threshold",
      },
      {
        ts: new Date(Date.now() - 20 * 60000).toISOString(),
        description: "Container entered CrashLoopBackOff",
      },
    ],
    openedAt: new Date(Date.now() - 25 * 60000).toISOString(),
  },
  {
    _id: "incident-2",
    clusterId: "cluster-3",
    resourceName: "recommendation-engine",
    type: "ImagePullBackOff",
    severity: "high",
    status: "open",
    rootCause: {
      possibleCauses: [
        {
          cause: "Container image unavailable",
          probability: 0.82,
        },
        {
          cause: "Registry authentication failure",
          probability: 0.12,
        },
        {
          cause: "Network connectivity issue",
          probability: 0.06,
        },
      ],
      affectedServices: ["recommendation-engine"],
      suggestedRemediation: [
        "Verify image tag",
        "Check container registry credentials",
        "Retry deployment",
      ],
      confidenceScore: 0.94,
    },
    timeline: [
      {
        ts: new Date(Date.now() - 40 * 60000).toISOString(),
        description: "Pod failed to pull container image",
      },
    ],
    openedAt: new Date(Date.now() - 40 * 60000).toISOString(),
  },
  {
    _id: "incident-3",
    clusterId: "cluster-3",
    resourceName: "staging-us-east",
    type: "HighMemoryUsage",
    severity: "medium",
    status: "acknowledged",
    rootCause: {
      possibleCauses: [
        {
          cause: "Memory usage above configured threshold",
          probability: 0.78,
        },
      ],
      affectedServices: ["recommendation-engine"],
      suggestedRemediation: [
        "Review memory requests and limits",
        "Inspect application memory usage",
      ],
      confidenceScore: 0.86,
    },
    timeline: [],
    openedAt: new Date(Date.now() - 90 * 60000).toISOString(),
  },
];

function demoResponse(data: unknown) {
  return Promise.resolve({
    data: {
      data,
    },
    status: 200,
    statusText: "OK",
    headers: {},
    config: {},
  });
}

const demoApi = {
  get(url: string, config?: { params?: Record<string, unknown> }) {
    if (url === "/auth/me") {
      return demoResponse({
        id: "demo-user-1",
        email: "platform@deploywatch.dev",
        name: "Priya (Platform Engineer)",
        role: "platform_engineer",
        orgId: "demo-org-1",
      });
    }

    if (url === "/dashboard/summary") {
      return demoResponse({
        avgClusterHealth: 89,
        clusterCount: 4,
        podCount: 76,
        openIncidentCount: DEMO_INCIDENTS.filter(
          (i) => i.status === "open"
        ).length,
        clusters: DEMO_CLUSTERS,
        worstDeployments: [
          DEMO_DEPLOYMENTS[4],
          DEMO_DEPLOYMENTS[2],
        ],
        criticalIncidents: DEMO_INCIDENTS.filter(
          (i) => i.severity === "critical"
        ),
      });
    }

    if (url === "/clusters") {
      return demoResponse(DEMO_CLUSTERS);
    }

    if (url.startsWith("/clusters/") && url.endsWith("/deployments")) {
      const clusterId = url.split("/")[2];

      return demoResponse(
        DEMO_DEPLOYMENTS.filter((d) => d.clusterId === clusterId)
      );
    }

    if (url.startsWith("/clusters/")) {
      const clusterId = url.split("/")[2];

      return demoResponse(
        DEMO_CLUSTERS.find((c) => c._id === clusterId) ??
          DEMO_CLUSTERS[0]
      );
    }

    if (url === "/incidents") {
      const status = config?.params?.status;

      if (!status || status === "all") {
        return demoResponse(DEMO_INCIDENTS);
      }

      return demoResponse(
        DEMO_INCIDENTS.filter((incident) => incident.status === status)
      );
    }

    if (url.startsWith("/deployments/") && url.endsWith("/pods")) {
      const id = url.split("/")[2];

      return demoResponse(
        DEMO_PODS.filter((pod) => pod.deploymentId === id)
      );
    }

    if (url.startsWith("/deployments/") && url.endsWith("/timeline")) {
      return demoResponse(
        Array.from({ length: 12 }, (_, index) => ({
          score: Math.max(
            45,
            96 - index * 3 + Math.round(Math.random() * 4)
          ),
          recordedAt: new Date(
            Date.now() - (11 - index) * 10 * 60000
          ).toISOString(),
        }))
      );
    }

    if (url.startsWith("/deployments/")) {
      const id = url.split("/")[2];

      return demoResponse(
        DEMO_DEPLOYMENTS.find((d) => d._id === id) ??
          DEMO_DEPLOYMENTS[0]
      );
    }

    if (url.startsWith("/pods/") && url.endsWith("/logs")) {
      const podId = url.split("/")[2];
      const pod = DEMO_PODS.find((p) => p._id === podId);

      return demoResponse({
        podName: pod?.name ?? "demo-pod",
        lines: [
          "INFO  Starting application container",
          "INFO  Connected to service dependencies",
          "INFO  Health check initialized",
          "WARN  Request latency above normal threshold",
          "INFO  Processing workload",
          "ERROR Container restarted unexpectedly",
          "INFO  Kubernetes restart policy triggered",
        ],
      });
    }

    return demoResponse({});
  },

  post(url: string) {
    if (url === "/auth/login") {
      return demoResponse({
        accessToken: "demo-access-token",
        refreshToken: "demo-refresh-token",
        user: {
          id: "demo-user-1",
          email: "platform@deploywatch.dev",
          name: "Priya (Platform Engineer)",
          role: "platform_engineer",
          orgId: "demo-org-1",
        },
      });
    }

    return demoResponse({});
  },

  patch(url: string) {
    if (url.startsWith("/incidents/")) {
      return demoResponse({});
    }

    return demoResponse({});
  },
};

export const api = demoApi;
