import { Schema, model, Types } from "mongoose";

export interface IActivityLog {
  orgId: Types.ObjectId;
  actorId?: Types.ObjectId;
  action: string;
  targetType: string;
  targetId?: Types.ObjectId;
  metadata: Record<string, unknown>;
  ts: Date;
}

const activityLogSchema = new Schema<IActivityLog>({
  orgId: { type: Schema.Types.ObjectId, required: true, index: true },
  actorId: { type: Schema.Types.ObjectId, ref: "User" },
  action: { type: String, required: true },
  targetType: { type: String, required: true },
  targetId: { type: Schema.Types.ObjectId },
  metadata: { type: Schema.Types.Mixed, default: {} },
  ts: { type: Date, default: Date.now },
});

export const ActivityLog = model<IActivityLog>("ActivityLog", activityLogSchema);
