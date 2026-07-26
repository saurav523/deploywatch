import { Schema, model, Types } from "mongoose";

export interface INode {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  clusterId: Types.ObjectId;
  name: string;
  capacity: { cpu: number; memoryMb: number; pods: number };
  usage: { cpuPercent: number; memoryPercent: number; diskPercent: number };
  pressure: { memory: boolean; disk: boolean; cpu: boolean };
  conditions: string[];
  status: "Ready" | "NotReady";
  labels: Record<string, string>;
  createdAt: Date;
  lastSeenAt: Date;
}

const nodeSchema = new Schema<INode>({
  orgId: { type: Schema.Types.ObjectId, required: true, index: true },
  clusterId: { type: Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true },
  capacity: {
    cpu: Number,
    memoryMb: Number,
    pods: Number,
  },
  usage: {
    cpuPercent: Number,
    memoryPercent: Number,
    diskPercent: Number,
  },
  pressure: {
    memory: { type: Boolean, default: false },
    disk: { type: Boolean, default: false },
    cpu: { type: Boolean, default: false },
  },
  conditions: [{ type: String }],
  status: { type: String, enum: ["Ready", "NotReady"], default: "Ready" },
  labels: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
});

export const NodeModel = model<INode>("Node", nodeSchema);
