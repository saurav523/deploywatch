import { Schema, model, Types } from "mongoose";

export interface IDeployment {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  clusterId: Types.ObjectId;
  namespace: string;
  name: string;
  image: string;
  replicas: { desired: number; ready: number; available: number; unavailable: number };
  resourceLimits: { cpu: string; memoryMb: number };
  resourceRequests: { cpu: string; memoryMb: number };
  healthScore: number;
  healthReasons: string[];
  status: "healthy" | "degraded" | "failing";
  lastRolloutAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const deploymentSchema = new Schema<IDeployment>({
  orgId: { type: Schema.Types.ObjectId, required: true, index: true },
  clusterId: { type: Schema.Types.ObjectId, required: true, index: true },
  namespace: { type: String, required: true },
  name: { type: String, required: true },
  image: { type: String, required: true },
  replicas: {
    desired: { type: Number, default: 1 },
    ready: { type: Number, default: 1 },
    available: { type: Number, default: 1 },
    unavailable: { type: Number, default: 0 },
  },
  resourceLimits: { cpu: String, memoryMb: Number },
  resourceRequests: { cpu: String, memoryMb: Number },
  healthScore: { type: Number, default: 100 },
  healthReasons: [{ type: String }],
  status: { type: String, enum: ["healthy", "degraded", "failing"], default: "healthy" },
  lastRolloutAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

deploymentSchema.index({ orgId: 1, clusterId: 1, namespace: 1, name: 1 }, { unique: true });

export const Deployment = model<IDeployment>("Deployment", deploymentSchema);
