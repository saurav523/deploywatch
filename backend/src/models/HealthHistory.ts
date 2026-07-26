import { Schema, model, Types } from "mongoose";

export interface IHealthHistory {
  orgId: Types.ObjectId;
  clusterId: Types.ObjectId;
  resourceType: "deployment" | "cluster";
  resourceId: Types.ObjectId;
  score: number;
  reasonCodes: string[];
  recordedAt: Date;
}

const healthHistorySchema = new Schema<IHealthHistory>({
  orgId: { type: Schema.Types.ObjectId, required: true, index: true },
  clusterId: { type: Schema.Types.ObjectId, required: true, index: true },
  resourceType: { type: String, enum: ["deployment", "cluster"], required: true },
  resourceId: { type: Schema.Types.ObjectId, required: true },
  score: { type: Number, required: true },
  reasonCodes: [{ type: String }],
  recordedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
});

export const HealthHistory = model<IHealthHistory>("HealthHistory", healthHistorySchema);
