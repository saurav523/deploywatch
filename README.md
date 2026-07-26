# DeployWatch

**Internal Platform Engineering & SRE console for multi-cloud Kubernetes fleets.**
Continuously scores deployment health, auto-detects incidents (CrashLoopBackOff, ImagePullBackOff, OOM, restart storms, pending pods) with rule-based root-cause analysis, and pushes live updates to the browser over WebSockets — the kind of internal tool platform teams at companies running hundreds of K8s workloads actually build.

Full architecture, ERD, API spec, and roadmap: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## What's real vs. simulated

Everything is a real, running full-stack application — auth, RBAC, MongoDB persistence, a health-scoring engine, a rule-based incident-detection engine with root-cause objects, live Socket.IO updates, and a React dashboard — **except the Kubernetes cluster connections themselves**, which are simulated by `backend/src/services/simulatorService.ts` rather than wired to real AWS/Azure/GCP credentials (which this environment obviously can't hold for you).

The simulator produces pod/node state in exactly the shape a real `@kubernetes/client-node` Watch-API ingestion worker would (see `docs/ARCHITECTURE.md` §3), and feeds it through the *same* health/incident engines real cluster events would hit. Swapping the simulator for a live `IClusterProvider` (EKS/AKS/GKE/on-prem adapters, also specced in the architecture doc) is an isolated change to one file — nothing downstream needs to change. This is a standard, honest way to build/demo an infra tool without needing a real production Kubernetes fleet on hand.

## Stack

- **Backend**: Node.js, TypeScript, Express, MongoDB/Mongoose, Socket.IO, JWT + RBAC, Zod validation, Jest/Supertest
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, Recharts, Socket.IO client
- **Infra**: Docker, Docker Compose, NGINX

## Run it locally (Docker — recommended)

```bash
cp backend/.env.example backend/.env   # edit secrets if you like
docker compose up --build
```

Then seed demo data (creates 4 clusters, ~30 deployments, ~80 pods, and 5 demo user accounts across different roles):

```bash
docker compose exec api npm run seed
```

Open **http://localhost:8080** and log in with any of:

| Email | Role |
|---|---|
| `platform@deploywatch.dev` | Platform Engineer |
| `sre@deploywatch.dev` | SRE |
| `devops@deploywatch.dev` | DevOps Engineer |
| `manager@deploywatch.dev` | Engineering Manager |
| `exec@deploywatch.dev` | Executive |

Password for all: `password123`

Within ~10-15 seconds of logging in, the simulator will have introduced at least one CrashLoopBackOff/ImagePullBackOff/restart-storm somewhere in the fleet — watch it show up live in Incidents without refreshing.

## Run it without Docker (dev mode)

```bash
# Terminal 1 — needs a local MongoDB on :27017, or point MONGO_URI at Atlas
cd backend
cp .env.example .env
npm install
npm run seed
npm run dev

# Terminal 2
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend dev server: **http://localhost:5173**

## Run the tests

```bash
cd backend
npm install
npm test
```

Covers the health-scoring algorithm (pure function, fully unit-tested) and the auth flow (integration tests against an in-memory MongoDB via `mongodb-memory-server` — no real DB needed to run `npm test`).

## Project structure

```
deploywatch/
├── docs/ARCHITECTURE.md      # full system design: schema, API spec, diagrams, roadmap
├── backend/
│   └── src/
│       ├── models/            # Mongoose schemas
│       ├── services/          # healthEngine, incidentEngine, alertService, simulatorService
│       ├── controllers/ routes/ middleware/
│       ├── sockets/            # Socket.IO gateway
│       ├── jobs/                # simulator tick loop
│       └── seed/                 # demo data generator
├── frontend/
│   └── src/
│       ├── pages/               # Dashboard, Clusters, ClusterDetail, DeploymentDetail, Incidents
│       ├── components/           # shared UI primitives + Layout
│       ├── context/               # auth
│       └── lib/                    # API client, socket client
└── docker-compose.yml
```

## What to say about this on a resume / in an interview

This is a good project to talk through because every non-obvious decision has a reason you can explain out loud:

- **Health scoring is a pure, unit-tested function** (`computeDeploymentHealth`) separated from the I/O that calls it — so the scoring *logic* is testable without a database, and the weights/penalties can be tuned and covered by tests independently.
- **Incident detection is rule-based with an explicit rule table**, not a black box — each rule states its type, severity, and a root-cause explanation with probabilities, which is what actually makes "root cause analysis" credible instead of decorative.
- **Domain events flow through a single in-process EventEmitter** (`eventBus.ts`) that both the alert dispatcher and the Socket.IO gateway subscribe to — decoupling detection from delivery, and marking exactly where you'd swap in Redis pub/sub for a multi-instance deployment (documented in the architecture doc, not hand-waved).
- **Everything Kubernetes-shaped is behind one seam** (the simulator vs. a real cluster provider), so you can speak to how you'd extend it to real clusters without having built a toy that only works with fake data by accident.

## Extending toward the full architecture doc

`docs/ARCHITECTURE.md` specs out the full original scope (AI assistant, cost analytics, capacity forecasting, release/rollback tracking, multi-channel alerting, PDF/Excel reports, audit logs, cloud-provider adapters). This repo implements Phase 1-3 of that roadmap (Foundations, Ingestion, Health Engine & Incidents) as a complete, working slice. Phases 4-10 are scoped and ready to build the same way — one fully-working module at a time.
