import mongoose, { Types } from "mongoose";
import { env } from "../config/env";
import { User } from "../models/User";
import { Cluster } from "../models/Cluster";
import { NodeModel } from "../models/Node";
import { Deployment } from "../models/Deployment";
import { Pod } from "../models/Pod";
import { hashPassword } from "../services/authService";
import { logger } from "../utils/logger";

const DEMO_SERVICES = [
  "checkout-service", "payments-api", "auth-service", "inventory-service",
  "notification-worker", "search-api", "recommendation-engine", "user-profile-service",
  "cart-service", "shipping-calculator",
];

const NAMESPACES = ["default", "payments", "platform", "growth"];

const ROLES: { email: string; name: string; role: string }[] = [
  { email: "platform@deploywatch.dev", name: "Priya (Platform Engineer)", role: "platform_engineer" },
  { email: "sre@deploywatch.dev", name: "Sam (SRE)", role: "sre" },
  { email: "devops@deploywatch.dev", name: "Devon (DevOps)", role: "devops" },
  { email: "manager@deploywatch.dev", name: "Morgan (Eng Manager)", role: "eng_manager" },
  { email: "exec@deploywatch.dev", name: "Alex (VP Engineering)", role: "executive" },
];

async function seed() {
  await mongoose.connect(env.mongoUri);
  logger.info("Seeding database...");

  await Promise.all([
    User.deleteMany({}),
    Cluster.deleteMany({}),
    NodeModel.deleteMany({}),
    Deployment.deleteMany({}),
    Pod.deleteMany({}),
  ]);

  const orgId = new Types.ObjectId();
  const passwordHash = await hashPassword("password123");

  for (const u of ROLES) {
    await User.create({ orgId, email: u.email, passwordHash, name: u.name, role: u.role });
  }

  const clusterSpecs = [
    { name: "prod-us-east", provider: "eks", region: "us-east-1", environment: "production" },
    { name: "prod-eu-west", provider: "aks", region: "eu-west-1", environment: "production" },
    { name: "staging-us-east", provider: "gke", region: "us-east1", environment: "staging" },
    { name: "dev-cluster", provider: "onprem", region: "on-prem-dc1", environment: "development" },
  ] as const;

  for (const spec of clusterSpecs) {
    const cluster = await Cluster.create({
      orgId,
      name: spec.name,
      provider: spec.provider,
      region: spec.region,
      environment: spec.environment,
      status: "healthy",
      clusterHealthScore: 100,
      createdAt: new Date(),
    });

    const nodeCount = spec.environment === "production" ? 6 : 3;
    const nodeIds: Types.ObjectId[] = [];
    for (let i = 0; i < nodeCount; i++) {
      const node = await NodeModel.create({
        orgId,
        clusterId: cluster._id,
        name: `${spec.name}-node-${i + 1}`,
        capacity: { cpu: 8, memoryMb: 32768, pods: 110 },
        usage: { cpuPercent: 20 + Math.random() * 30, memoryPercent: 30 + Math.random() * 30, diskPercent: 25 },
        status: "Ready",
      });
      nodeIds.push(node._id);
    }

    const serviceCount = spec.environment === "production" ? 8 : 5;
    const services = DEMO_SERVICES.slice(0, serviceCount);
    for (const svcName of services) {
      const namespace = NAMESPACES[Math.floor(Math.random() * NAMESPACES.length)];
      const desired = spec.environment === "production" ? 3 : 2;

      const deployment = await Deployment.create({
        orgId,
        clusterId: cluster._id,
        namespace,
        name: svcName,
        image: `registry.internal/${svcName}:v1.${Math.floor(Math.random() * 20)}.0`,
        replicas: { desired, ready: desired, available: desired, unavailable: 0 },
        resourceLimits: { cpu: "500m", memoryMb: 512 },
        resourceRequests: { cpu: "250m", memoryMb: 256 },
        healthScore: 100,
        status: "healthy",
      });

      for (let i = 0; i < desired; i++) {
        await Pod.create({
          orgId,
          clusterId: cluster._id,
          deploymentId: deployment._id,
          nodeId: nodeIds[Math.floor(Math.random() * nodeIds.length)],
          namespace,
          name: `${svcName}-${Math.random().toString(36).slice(2, 7)}-${Math.random().toString(36).slice(2, 6)}`,
          phase: "Running",
          restartCount: 0,
          ready: true,
          resourceUsage: { cpuPercent: 15 + Math.random() * 20, memoryPercent: 25 + Math.random() * 25 },
        });
      }
    }

    cluster.nodeCount = nodeCount;
    cluster.namespaceCount = NAMESPACES.length;
    await cluster.save();
  }

  logger.info(
    { orgId: orgId.toString() },
    "Seed complete. Demo logins: platform@deploywatch.dev / password123 (any role email above, same password)"
  );
  await mongoose.disconnect();
}

seed().catch((err) => {
  logger.error({ err }, "Seed failed");
  process.exit(1);
});
