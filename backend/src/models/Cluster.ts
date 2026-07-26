import { Schema, model, Types } from "mongoose";

export type CloudProvider = "eks" | "aks" | "gke" | "onprem";
export type ClusterEnvironment = "production" | "staging" | "qa" | "development";
export type ClusterStatus = "healthy" | "degraded" | "unreachable";

export interface ICluster {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  provider: CloudProvider;
  region: string;
  environment: ClusterEnvironment;
  labels: Record<string, string>;
  status: ClusterStatus;
  clusterHealthScore: number;
  nodeCount: number;
  namespaceCount: number;
  lastSyncedAt: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const clusterSchema = new Schema<ICluster>({
  orgId: { type: Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true },
  provider: { type: String, enum: ["eks", "aks", "gke", "onprem"], required: true },
  region: { type: String, required: true },
  environment: {
    type: String,
    enum: ["production", "staging", "qa", "development"],
    required: true,
  },
  labels: { type: Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ["healthy", "degraded", "unreachable"], default: "healthy" },
  clusterHealthScore: { type: Number, default: 100 },
  nodeCount: { type: Number, default: 0 },
  namespaceCount: { type: Number, default: 0 },
  lastSyncedAt: { type: Date, default: Date.now },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

export const Cluster = model<ICluster>("Cluster", clusterSchema);
