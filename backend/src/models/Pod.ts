import { Schema, model, Types } from "mongoose";

export interface IPod {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  clusterId: Types.ObjectId;
  deploymentId: Types.ObjectId;
  nodeId?: Types.ObjectId;
  namespace: string;
  name: string;
  phase: "Running" | "Pending" | "CrashLoopBackOff" | "ImagePullBackOff" | "Failed" | "Succeeded";
  restartCount: number;
  ready: boolean;
  resourceUsage: { cpuPercent: number; memoryPercent: number };
  lastReason?: string;
  createdAt: Date;
  lastTransitionAt: Date;
}

const podSchema = new Schema<IPod>({
  orgId: { type: Schema.Types.ObjectId, required: true, index: true },
  clusterId: { type: Schema.Types.ObjectId, required: true, index: true },
  deploymentId: { type: Schema.Types.ObjectId, required: true, index: true },
  nodeId: { type: Schema.Types.ObjectId },
  namespace: { type: String, required: true },
  name: { type: String, required: true },
  phase: {
    type: String,
    enum: ["Running", "Pending", "CrashLoopBackOff", "ImagePullBackOff", "Failed", "Succeeded"],
    default: "Running",
  },
  restartCount: { type: Number, default: 0 },
  ready: { type: Boolean, default: true },
  resourceUsage: {
    cpuPercent: { type: Number, default: 0 },
    memoryPercent: { type: Number, default: 0 },
  },
  lastReason: { type: String },
  createdAt: { type: Date, default: Date.now },
  lastTransitionAt: { type: Date, default: Date.now },
});

export const Pod = model<IPod>("Pod", podSchema);
