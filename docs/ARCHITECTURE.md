# DeployWatch — System Architecture

**Internal Platform Engineering & SRE Console for Multi-Cloud Kubernetes Fleets**

Version 1.0 · Architecture Phase Deliverable

---

## 0. Scope Note on This Phase

This document is the architecture phase deliverable. It defines everything needed before writing implementation code: system boundaries, data model, API contracts, folder structure, and a roadmap. Implementation will follow in phased, fully-working modules (no placeholder files, no stubbed endpoints) — see §13 Roadmap for the build order.

---

## 1. Complete System Architecture

### 1.1 Architectural Style
DeployWatch is a **modular monolith with a real-time edge**, not a premature microservice sprawl. A single Node.js/TypeScript backend exposes REST + WebSocket APIs, organized internally with Clean Architecture layering (see §9). This is deliberate: platform tools like this live or die on operational simplicity — one deployable backend, one Redis, one MongoDB, one Socket.IO layer — while still being cleanly decomposable into services later if scale demands it.

### 1.2 Major Subsystems

```
┌──────────────────────────────────────────────────────────────────────┐
│                           CLIENT (React 19 SPA)                       │
│  Role-based dashboards · Topology graphs · Live incident feed         │
└───────────────┬───────────────────────────────────┬───────────────────┘
                │ REST (TanStack Query)              │ WebSocket (Socket.IO)
┌───────────────▼───────────────────────────────────▼───────────────────┐
│                         API GATEWAY LAYER (Express)                    │
│  AuthN/AuthZ (JWT+RBAC) · Rate limiting · Validation · Request logging │
├──────────────────────────────────────────────────────────────────────┤
│                          APPLICATION SERVICE LAYER                     │
│  ClusterService · HealthEngine · IncidentEngine · AlertEngine          │
│  ReleaseService · CapacityForecastService · CostAnalyticsService       │
│  AIAssistantService · ReportService · AuditService                     │
├──────────────────────────────────────────────────────────────────────┤
│                          DOMAIN / REPOSITORY LAYER                     │
│  Mongoose repositories · Domain models · Score calculators             │
├───────────────┬───────────────────────┬──────────────────┬────────────┤
│   MongoDB      │        Redis          │     BullMQ       │  Socket.IO │
│ (system of     │ (cache + pub/sub for  │ (background jobs:│ (live push │
│  record)       │  live metric fan-out) │  polling, scoring,│ to browser)│
│                │                       │  forecasting)     │            │
└───────────────┴───────────────────────┴──────────────────┴────────────┘
                │
┌───────────────▼──────────────────────────────────────────────────────┐
│                    CLUSTER INGESTION LAYER (per registered cluster)    │
│  K8s Client-Go-equivalent (@kubernetes/client-node) · Watch API        │
│  AWS SDK (EKS) · Azure SDK (AKS) · GKE SDK · Metrics Server / Prom     │
└──────────────────────────────────────────────────────────────────────┘
                │
        ┌───────┴────────┬─────────────────┬──────────────────┐
        ▼                ▼                 ▼                  ▼
   AWS EKS clusters  Azure AKS clusters  GKE clusters     On-prem clusters
```

### 1.3 Core Design Principles
1. **Pull + Watch, not just poll.** Use the Kubernetes Watch API for near-real-time pod/deployment/event streams; fall back to interval polling (configurable, default 15s) for clusters where watch isn't viable (e.g. behind restrictive network policies).
2. **Health is computed, not stored as truth.** Raw signals (restarts, pressure, events) are stored; the Health Score is *derived* on write and recomputed on read-through cache invalidation, so scoring logic can evolve without backfilling.
3. **Every incident is explainable.** No black-box alert — every incident record carries its trigger signals and a root-cause explanation object.
4. **Multi-tenancy by cluster, not by schema duplication.** One MongoDB deployment, tenant isolation via `clusterId`/`orgId` scoping at the repository layer + RBAC.
5. **Degrade gracefully.** If a cluster becomes unreachable, DeployWatch shows "stale data since X" rather than silently freezing or crashing the UI.

---

## 2. High-Level Architecture Diagram

```
                              ┌────────────────────┐
                              │   React 19 SPA      │
                              │ (Vite, TS, Tailwind)│
                              └─────────┬───────────┘
                    REST/JSON           │        WebSocket (live)
        ┌───────────────────────────────┼───────────────────────────┐
        ▼                               ▼                           ▼
┌──────────────┐              ┌──────────────────┐        ┌──────────────────┐
│  Express API  │◄────────────►  Socket.IO Gateway │◄──────►  Redis Pub/Sub    │
│  (REST)       │              │  (rooms per       │        │  (metric/incident │
│               │              │   cluster/role)    │        │   fan-out bus)    │
└──────┬────────┘              └────────┬──────────┘        └─────────┬─────────┘
       │                                │                             │
       ▼                                ▼                             │
┌──────────────────────────────────────────────────────┐              │
│                  Application Services                 │              │
│  Health Engine · Incident Engine · Alert Engine        │              │
│  Release Tracker · Forecasting · Cost Analytics         │              │
│  AI Assistant (LLM-backed) · Report Generator            │              │
└───────────────┬─────────────────────┬───────────────┘              │
                 ▼                     ▼                              │
        ┌────────────────┐   ┌─────────────────┐                     │
        │    MongoDB      │   │   BullMQ Queues  │◄────────────────────┘
        │ (Mongoose ODM)  │   │ (poll, score,     │
        │                 │   │  forecast, notify)│
        └────────────────┘   └────────┬────────┘
                                       ▼
                          ┌────────────────────────┐
                          │ Kubernetes Ingestion     │
                          │ Workers (per cluster)    │
                          │ @kubernetes/client-node  │
                          └────────────┬────────────┘
                                       ▼
                    ┌──────────────────────────────────────┐
                    │  AWS EKS │ Azure AKS │ GKE │ On-prem   │
                    └──────────────────────────────────────┘
```

---

## 3. Kubernetes Integration Architecture

### 3.1 Cluster Registration Flow
1. User uploads kubeconfig (or provides IRSA/Workload Identity role ARN for keyless auth on EKS/GKE/AKS).
2. Kubeconfig is validated (`kubectl auth can-i` style dry-run against required verbs: `get`, `list`, `watch` on core + apps + metrics APIs).
3. Kubeconfig is encrypted at rest (AES-256-GCM, key from AWS KMS/Secrets Manager) and stored — DeployWatch never stores plaintext credentials, and Secrets in `Secrets (metadata only)` scope means DeployWatch **only reads Secret names/metadata/type, never values**.
4. A dedicated **Ingestion Worker** process is assigned the cluster and opens Watch connections.

### 3.2 Ingestion Worker Responsibilities
- Maintains persistent Watch streams for: Pods, Deployments, ReplicaSets, StatefulSets, DaemonSets, Jobs, CronJobs, Nodes, Events, Services, Ingress, PV/PVC, ConfigMaps (metadata), Secrets (metadata).
- Normalizes raw K8s objects into DeployWatch's internal resource schema (decoupling UI/API from raw K8s API version churn).
- Emits normalized change events onto Redis pub/sub channel `cluster:{clusterId}:events`.
- On watch disconnect: exponential backoff reconnect (max 60s), marks cluster `degraded` in Mongo after 3 missed cycles, `unreachable` after 5 minutes.
- Pulls metrics from `metrics-server` (CPU/memory) and optionally scrapes a user-provided Prometheus endpoint for request volume/latency/error-rate (four-golden-signals style), normalized into a common `MetricPoint` shape regardless of source.

### 3.3 Multi-Cluster Fan-Out
Each cluster's ingestion worker is a BullMQ "repeatable + persistent connection" worker — not just a queued job — supervised by a lightweight worker-pool manager that restarts crashed workers and load-balances across worker processes (via `WORKER_CONCURRENCY` env var) so hundreds of clusters don't require hundreds of Node processes.

### 3.4 Cloud-Specific Adapters
A common `IClusterProvider` interface with implementations:
- `EksProvider` (AWS SDK v3 `@aws-sdk/client-eks` for cluster metadata + IAM auth token exchange)
- `AksProvider` (Azure `@azure/arm-containerservice` + AAD token)
- `GkeProvider` (`google-auth-library` + GKE cluster API)
- `OnPremProvider` (raw kubeconfig, no cloud metadata enrichment)

Each adapter only differs in **auth token acquisition** and **cost/metadata enrichment** — the actual K8s API interaction is unified through `@kubernetes/client-node` once a valid token/kubeconfig is resolved.

---

## 4. MongoDB Schema Design

All collections use `orgId` + (where applicable) `clusterId` for tenant scoping and are indexed accordingly.

```
users
  _id, orgId, email, passwordHash, name, role [platform_engineer|devops|sre|
  backend_engineer|eng_manager|release_manager|cloud_admin|executive],
  permissions[], lastLoginAt, createdAt

clusters
  _id, orgId, name, provider [eks|aks|gke|onprem], region, environment
  [production|staging|qa|development], labels{}, kubeconfigEncrypted,
  authMethod, status [healthy|degraded|unreachable], lastSyncedAt,
  clusterHealthScore, nodeCount, namespaceCount, createdBy, createdAt

nodes
  _id, orgId, clusterId, name, capacity{cpu,memory,disk,pods},
  allocatable{}, conditions[], taints[], labels{}, pressure
  {memory,disk,pid,cpu}, status, kubeletVersion, createdAt, lastSeenAt

namespaces
  _id, orgId, clusterId, name, labels{}, status, resourceQuota{}

deployments
  _id, orgId, clusterId, namespace, name, replicas{desired,ready,
  available,unavailable}, images[], strategy, resourceLimits{},
  resourceRequests{}, envVars[](keys only for secrets), volumes[],
  labels{}, healthScore, healthReason, lastRolloutAt, status,
  createdAt, updatedAt

replicasets / statefulsets / daemonsets / jobs / cronjobs
  _id, orgId, clusterId, namespace, name, ownerDeploymentId, spec{},
  status{}, createdAt

pods
  _id, orgId, clusterId, namespace, name, deploymentId, nodeId,
  phase, containerStatuses[{name,restartCount,state,reason,
  lastTerminatedReason}], readiness, liveness, resourceUsage{cpu,mem},
  restartCount, createdAt, lastTransitionAt

services / ingresses
  _id, orgId, clusterId, namespace, name, type, ports[], targets[],
  rules[] (ingress only), status

persistentvolumes / persistentvolumeclaims
  _id, orgId, clusterId, name, namespace (pvc only), capacity,
  status, storageClass, boundTo

configmaps / secrets (metadata only)
  _id, orgId, clusterId, namespace, name, keys[] (names only),
  type (secrets only), createdAt   // NOTE: secret VALUES never stored

events
  _id, orgId, clusterId, namespace, involvedObject{kind,name,uid},
  reason, message, type [Normal|Warning], count, firstTimestamp,
  lastTimestamp

healthHistory
  _id, orgId, clusterId, resourceType, resourceId, score, reasonCodes[],
  recordedAt   // time-series, TTL-indexed (90 days rolling)

incidents
  _id, orgId, clusterId, resourceType, resourceId, type
  [CrashLoopBackOff|ImagePullBackOff|OOMKilled|NodeNotReady|PodPending|
  DeploymentFailed|HighRestartRate|MemoryLeakPattern|CPUSaturation|
  NetworkFailure|StorageFailure|ServiceUnavailable|AutoscalerFailure|
  DNSResolutionIssue|CertificateExpiration],
  severity [critical|high|medium|low], status [open|acknowledged|
  resolved], rootCause{possibleCauses[{cause,probability}],
  affectedServices[], relatedEventIds[], suggestedRemediation[],
  confidenceScore}, timeline[{ts,description}], openedAt, resolvedAt,
  assignedTo

alerts
  _id, orgId, incidentId, ruleId, channel [slack|teams|discord|email],
  status [pending|sent|failed], sentAt, payload{}

notificationRules
  _id, orgId, name, conditions{metric,operator,threshold,duration},
  channels[], severity, isActive, createdBy

releases
  _id, orgId, clusterId, deploymentId, version, commitSha, author,
  deployedAt, durationMs, status [success|failed|rolled_back],
  rollbackReason, previousVersion

reports
  _id, orgId, type [daily|weekly|monthly|deployment|incident|
  cluster_health], format [pdf|excel|csv], generatedAt, generatedBy,
  fileUrl, params{}

activityLogs
  _id, orgId, actorId, action, targetType, targetId, metadata{}, ts

auditLogs
  _id, orgId, actorId, action [deploy|rollback|modify_resource|
  access_cluster|register_cluster|delete_cluster], targetType,
  targetId, ipAddress, ts

costReports
  _id, orgId, clusterId, period{start,end}, cpuCost, memoryCost,
  storageCost, idleResourceCost, overprovisionedWorkloads[],
  optimizationOpportunities[], totalEstimatedCost

capacityForecasts
  _id, orgId, clusterId, resourceType [cpu|memory|storage|nodes],
  horizon [7d|30d], projectedExhaustionAt, currentUtilization,
  projectedUtilization[], confidence, generatedAt
```

**Indexing strategy:** compound indexes on `{orgId, clusterId, updatedAt}` for all live-resource collections; TTL index on `healthHistory.recordedAt` (90d) and `events.lastTimestamp` (30d); text index on `deployments.name`, `pods.name`, `services.name` for global search.

---

## 5. API Specification (excerpt — full OpenAPI spec delivered as `openapi.yaml` in implementation phase)

```
Auth
  POST   /api/v1/auth/login
  POST   /api/v1/auth/refresh
  POST   /api/v1/auth/logout

Clusters
  GET    /api/v1/clusters
  POST   /api/v1/clusters                    (register, kubeconfig upload)
  GET    /api/v1/clusters/:id
  PATCH  /api/v1/clusters/:id
  DELETE /api/v1/clusters/:id
  GET    /api/v1/clusters/:id/health
  POST   /api/v1/clusters/:id/resync

Resources
  GET    /api/v1/clusters/:id/nodes
  GET    /api/v1/clusters/:id/nodes/:nodeId
  GET    /api/v1/clusters/:id/deployments?namespace=&status=&page=&sort=
  GET    /api/v1/clusters/:id/deployments/:depId
  GET    /api/v1/clusters/:id/deployments/:depId/timeline
  GET    /api/v1/clusters/:id/pods?deploymentId=&status=
  GET    /api/v1/pods/:podId/logs?container=&tail=&follow=
  GET    /api/v1/clusters/:id/services
  GET    /api/v1/clusters/:id/ingresses
  GET    /api/v1/clusters/:id/storage        (PV/PVC combined view)

Health & Incidents
  GET    /api/v1/clusters/:id/incidents?status=&severity=
  GET    /api/v1/incidents/:id                (full root-cause object)
  PATCH  /api/v1/incidents/:id                (acknowledge/resolve/assign)
  GET    /api/v1/clusters/:id/health-history?resourceId=&range=

Alerts
  GET    /api/v1/notification-rules
  POST   /api/v1/notification-rules
  PATCH  /api/v1/notification-rules/:id
  DELETE /api/v1/notification-rules/:id
  POST   /api/v1/notification-rules/:id/test

Releases & Rollback
  GET    /api/v1/clusters/:id/releases
  GET    /api/v1/releases/:id
  POST   /api/v1/releases/:id/rollback-recommendation
  POST   /api/v1/releases/:id/rollback         (executes, audited)

Capacity & Cost
  GET    /api/v1/clusters/:id/capacity-forecast?horizon=7d|30d
  GET    /api/v1/clusters/:id/cost-report?period=

AI
  POST   /api/v1/ai/chat                      { message, clusterId? }
  GET    /api/v1/ai/incidents/:id/summary
  GET    /api/v1/clusters/:id/ai/weekly-report

Search
  GET    /api/v1/search?q=&types=

Reports
  POST   /api/v1/reports                      (generate)
  GET    /api/v1/reports/:id/download

Audit / Activity
  GET    /api/v1/activity?clusterId=&range=
  GET    /api/v1/audit-logs?actorId=&action=

WebSocket events (Socket.IO, room-scoped per clusterId + role)
  cluster:health-update
  incident:new
  incident:resolved
  deployment:status-change
  pod:restart
  node:condition-change
  alert:fired
```

Standard response envelope: `{ data, meta: { page, pageSize, total }, error: null }`. All list endpoints support `page`, `pageSize`, `sort`, `filter[field]=value`.

---

## 6. UI Wireframes (role-based dashboards, described)

- **Platform Engineer** — Fleet-wide topology graph (React Flow) as the landing view; cluster health tiles; incident queue sorted by severity.
- **DevOps Engineer** — Deployment-centric: pipeline/release timeline front and center, rollback center one click away.
- **SRE** — Incident War Room view: live incident feed, root-cause panel, on-call alert routing status.
- **Backend Engineer** — Scoped to their team's namespaces only; pod logs/health for "my services."
- **Engineering Manager** — Release velocity, deployment success rate, team-level reliability trends — no raw pod tables.
- **Release Manager** — Release calendar, rollback risk analysis, deployment approval queue.
- **Cloud Administrator** — Cluster registration, cost analytics, capacity forecasting across providers.
- **Executive Leadership** — Single-page reliability scorecard: uptime %, incident count trend, cost trend, "what changed this week" AI summary. No operational detail.

Each dashboard is a composed set of shared widget components (§7) with role-specific layout configs — not separately hand-built pages.

---

## 7. Component Hierarchy (frontend)

```
<App>
 └─ <AuthProvider>
     └─ <RoleAwareLayout>
         ├─ <GlobalSearch />
         ├─ <ClusterSwitcher />
         ├─ <NotificationBell />
         └─ <Routes>
             ├─ /dashboard/:role        → <RoleDashboard>
             │    ├─ <HealthScoreTile>
             │    ├─ <IncidentQueue>
             │    ├─ <TopologyGraph>       (React Flow)
             │    ├─ <ResourceHeatmap>
             │    └─ <AIWeeklySummaryCard>
             ├─ /clusters                → <ClusterList> → <ClusterCard>
             ├─ /clusters/:id            → <ClusterOverview>
             │    ├─ <NodeTable> / <NodeDetailDrawer>
             │    ├─ <DeploymentTable> / <DeploymentDetailDrawer>
             │    │    ├─ <DeploymentTimeline>
             │    │    ├─ <ReplicaHistoryChart>   (Recharts)
             │    │    └─ <RollingUpdateProgress>
             │    ├─ <PodTable> / <PodDetailDrawer>
             │    │    ├─ <LogViewer>  (virtualized, live-tail)
             │    │    └─ <ContainerStatusBadges>
             │    └─ <NamespaceFilterBar>
             ├─ /incidents               → <IncidentBoard>
             │    └─ <IncidentDetailPanel> → <RootCausePanel> <RemediationSteps>
             ├─ /releases                → <ReleaseTimeline> <RollbackCenter>
             ├─ /capacity                → <ForecastCharts>
             ├─ /cost                    → <CostBreakdown> <OptimizationList>
             ├─ /reports                 → <ReportBuilder> <ReportHistory>
             ├─ /audit                   → <AuditLogTable>
             └─ /ai-assistant            → <ChatPanel>
 └─ <ToastProvider> <ThemeProvider (dark default)>
```

Shared primitives: `<Skeleton>`, `<EmptyState>`, `<ErrorBoundaryCard>`, `<SeverityBadge>`, `<LiveIndicator>` (pulsing dot tied to WebSocket connection state).

---

## 8. Folder Structure

```
deploywatch/
├── apps/
│   ├── api/                          # Express backend
│   │   ├── src/
│   │   │   ├── config/               # env, db, redis, queue config
│   │   │   ├── domain/                # entities, value objects, health scoring logic
│   │   │   ├── repositories/          # Mongoose-backed, interface-driven
│   │   │   ├── services/              # HealthEngine, IncidentEngine, AlertEngine, ...
│   │   │   ├── providers/             # EksProvider, AksProvider, GkeProvider, OnPremProvider
│   │   │   ├── ingestion/             # cluster watch workers
│   │   │   ├── api/
│   │   │   │   ├── routes/
│   │   │   │   ├── controllers/
│   │   │   │   ├── middlewares/       # auth, rbac, validation, rateLimit, errorHandler
│   │   │   │   └── validators/        # zod schemas
│   │   │   ├── sockets/               # Socket.IO gateway + room managers
│   │   │   ├── jobs/                  # BullMQ processors
│   │   │   ├── ai/                    # LLM prompt templates, chat orchestration
│   │   │   ├── utils/ logger/ 
│   │   │   └── server.ts
│   │   └── tests/  (unit + integration, Jest + Supertest)
│   └── web/                          # React frontend
│       ├── src/
│       │   ├── app/                   # routing, providers
│       │   ├── features/              # feature-based: clusters/ deployments/ pods/
│       │   │                           incidents/ releases/ capacity/ cost/ ai/ audit/
│       │   │   └── <feature>/{components,hooks,api,types}
│       │   ├── components/ui/         # shared design-system primitives
│       │   ├── lib/                   # axios/query client, socket client
│       │   ├── stores/                # lightweight client state (auth, theme)
│       │   └── styles/
│       └── tests/
├── packages/
│   └── shared-types/                  # DTOs shared between api and web (TS project refs)
├── docker/
│   ├── Dockerfile.api  Dockerfile.web  nginx.conf
├── docker-compose.yml
├── .github/workflows/                 # CI: lint, test, build
└── docs/  ARCHITECTURE.md  (this file), openapi.yaml, ADRs/
```

---

## 9. Engineering Quality — Applied Clean Architecture

- **Domain layer**: pure TypeScript, no framework imports — health scoring, incident classification rules, forecasting math live here so they're independently unit-testable.
- **Repository layer**: `IClusterRepository`, `IDeploymentRepository`, etc., interfaces in `domain/`, Mongoose implementations in `repositories/`. Services depend on interfaces (constructor injection via a lightweight container, e.g. `tsyringe`), enabling test doubles.
- **Service layer**: orchestrates repositories + providers; owns transactions and cross-cutting rules (e.g. "opening an incident must also check active notification rules").
- **Controllers**: thin — parse/validate (zod), call service, shape response. No business logic.
- **Structured logging**: `pino`, correlation-ID per request, JSON logs shippable to CloudWatch.
- **Caching**: Redis read-through cache for hot list endpoints (cluster overview, dashboard tiles), invalidated on relevant write/ingestion events.

---

## 10. Security Architecture

- **AuthN**: JWT access token (15 min) + rotating refresh token (7d, httpOnly cookie).
- **AuthZ**: RBAC with role → permission matrix (§ role list in Target Users); resource-level scoping (namespace/team ownership) enforced at repository query level, not just UI hiding.
- **Kubeconfig handling**: uploaded over TLS, encrypted at rest (KMS-backed envelope encryption), decrypted only in-memory inside the ingestion worker process, never logged.
- **Secrets**: DeployWatch stores **zero** Kubernetes Secret values — metadata (name, type, key names) only, enforced at the ingestion normalization step (values are stripped before the object ever leaves the watch handler).
- **Rate limiting**: `express-rate-limit` + Redis store, per-user and per-IP tiers; stricter limits on `/auth/*` and `/rollback`.
- **Input validation**: zod schemas on every mutating endpoint; Mongoose schema validation as second line of defense.
- **Audit logs**: append-only collection, written synchronously (not queued) for deploy/rollback/access-cluster/delete actions so they can't be lost on crash.
- **Transport**: TLS everywhere (NGINX terminates, re-encrypts to backend in production); HSTS, CSP headers via `helmet`.

---

## 11. Deployment Architecture

```
                         Route53 / DNS
                               │
                          ┌────▼────┐
                          │  NGINX   │  (TLS termination, reverse proxy,
                          │  (EC2)   │   static asset serving for web build)
                          └────┬────┘
              ┌────────────────┼────────────────┐
              ▼                ▼                 ▼
        ┌───────────┐   ┌───────────┐    ┌───────────────┐
        │  API (x N) │   │ Socket.IO  │    │ Static web     │
        │  containers│   │ (sticky    │    │ bundle (Vite   │
        │  (ECR img) │   │  sessions) │    │  build)         │
        └─────┬─────┘   └─────┬─────┘    └───────────────┘
              │               │
              ▼               ▼
        ┌───────────┐   ┌───────────┐
        │  MongoDB   │   │   Redis    │
        │ (Atlas or  │   │ (ElastiCache│
        │  self-host)│   │  /container)│
        └───────────┘   └───────────┘
              │
              ▼
        ┌────────────────────┐
        │ Ingestion Workers    │  (separate ECS/EC2 pool,
        │ (scale by cluster    │   horizontally scalable,
        │  count / worker)     │   independent from API pool)
        └────────────────────┘
```

---

## 12. AWS Deployment Plan

| Component | Service |
|---|---|
| Container registry | AWS ECR |
| Compute (API, workers, web) | EC2 (Docker Compose per instance for MVP) → migrate to ECS Fargate at scale |
| Reverse proxy / TLS | NGINX on EC2 (or ALB + ACM in ECS phase) |
| Database | MongoDB Atlas (managed) or self-hosted on EC2 for MVP |
| Cache/Queue backing | ElastiCache for Redis |
| Metrics/Logs | AWS CloudWatch (structured JSON logs, custom metrics for ingestion lag) |
| Secrets | AWS Secrets Manager / KMS for kubeconfig encryption keys |
| CI/CD | GitHub Actions → build, test, push to ECR, deploy via SSH/ECS update |

MVP topology (Docker Compose on a single well-sized EC2 instance) is the deliberate starting point — matches the "don't over-engineer" principle in §1.1 — with a clear, documented path to ECS Fargate + ALB once cluster count or team size justifies it.

---

## 13. Docker Architecture

```yaml
# docker-compose.yml (structure, not final file)
services:
  nginx:      # reverse proxy, serves web/dist, proxies /api and /socket.io
  api:        # apps/api image, env from .env, depends_on mongo, redis
  worker:     # same image as api, different entrypoint (ingestion + BullMQ)
  web:        # multi-stage build → static files copied into nginx image
  mongo:      # mongo:7, volume-backed
  redis:      # redis:7, volume-backed (AOF persistence for queue durability)
```

- `Dockerfile.api`: multi-stage (deps → build → slim runtime, non-root user).
- `Dockerfile.web`: build stage (Vite) → copy `dist/` into `nginx:alpine` stage.
- Health checks defined for every service (`/healthz` on api, `mongosh ping`, `redis-cli ping`).

---

## 14. Development Roadmap

**Phase 0 — Architecture (this document + OpenAPI spec + ADRs)** ✅ current phase

**Phase 1 — Foundations**
Auth (JWT+RBAC), cluster registration + kubeconfig encryption, MongoDB schema + repositories, base Express app, base React app shell with role-aware routing, Docker Compose dev environment.

**Phase 2 — Core Ingestion**
K8s ingestion workers (Watch API), normalized resource storage, Node/Pod/Deployment/Service/Ingress/Storage list+detail views, live WebSocket updates.

**Phase 3 — Health Engine & Incident Detection**
Health score calculator, incident detection rules, incident board UI, root-cause object generation (rule-based first, AI-assisted second).

**Phase 4 — Alerting**
Notification rules engine, Slack/Teams/Discord/email webhook integrations, alert history.

**Phase 5 — Releases & Rollback**
Release tracking (via CI webhook or manual record), rollback center with risk analysis, deployment timeline UI.

**Phase 6 — Observability & Forecasting**
Historical trend charts, resource heatmaps, capacity forecasting (linear/regression-based), service dependency map (React Flow topology).

**Phase 7 — Cost Analytics**
Cost estimation model (cloud pricing APIs / static rate tables), optimization suggestions.

**Phase 8 — AI Layer**
AI incident summaries, AI chat assistant, AI weekly report — all backed by an LLM call layer with tool-calling into the existing service layer (so the AI answers from real data, not hallucinated summaries).

**Phase 9 — Reports, Search, Audit**
PDF/Excel/CSV report generation, global search, audit log viewer.

**Phase 10 — Hardening**
Test coverage pass (Jest/Supertest, RTL, integration + E2E), load testing ingestion at simulated 50+ cluster scale, security review, deployment to AWS.

Each phase ships a working, demoable slice — never a partial/broken one.

---

## 15. Sequence Diagrams

### 15.1 Continuous Monitoring Flow
```
IngestionWorker → K8s API: Watch(Pods, Deployments, Nodes, Events)
K8s API → IngestionWorker: change event (e.g. Pod OOMKilled)
IngestionWorker → Normalizer: normalize raw object
Normalizer → MongoDB: upsert pod document
Normalizer → Redis: publish cluster:{id}:events
HealthEngine (subscriber) → MongoDB: recompute deployment health score
HealthEngine → MongoDB: write healthHistory entry (score, reasonCodes)
HealthEngine → Redis: publish health-update event
SocketGateway (subscriber) → Browser: emit "cluster:health-update"
Browser → UI: update HealthScoreTile, ReplicaHistoryChart
```

### 15.2 Incident Detection & Alerting Flow
```
HealthEngine → IncidentEngine: signal (restart count threshold crossed)
IncidentEngine → RuleSet: evaluate CrashLoopBackOff / OOMKilled / ... rules
RuleSet → IncidentEngine: match found (type=CrashLoopBackOff, confidence=0.9)
IncidentEngine → RootCauseAnalyzer: build possibleCauses[], affectedServices[]
RootCauseAnalyzer → MongoDB: query related Events, recent Deployments
RootCauseAnalyzer → IncidentEngine: rootCause object
IncidentEngine → MongoDB: insert incident (status=open)
IncidentEngine → AlertEngine: evaluate active notificationRules
AlertEngine → MongoDB: match rule (severity>=high)
AlertEngine → BullMQ: enqueue alert-dispatch job (channel=slack)
Worker → Slack Webhook: POST incident summary
Worker → MongoDB: update alert.status=sent
IncidentEngine → Redis: publish incident:new
SocketGateway → Browser: emit "incident:new"
Browser → IncidentQueue: prepend new incident card (toast + badge)
```

---

## Next Step

With this architecture locked, implementation proceeds phase by phase (§14). Recommended starting point: **Phase 1 — Foundations**, since every later phase depends on auth, cluster registration, and the base app shells being real and working.
