import { Schema, model, Types } from "mongoose";

export type IncidentType =
  | "CrashLoopBackOff"
  | "ImagePullBackOff"
  | "OOMKilled"
  | "NodeNotReady"
  | "PodPending"
  | "HighRestartRate"
  | "CPUSaturation"
  | "MemoryPressure";

export type IncidentSeverity = "critical" | "high" | "medium" | "low";
export type IncidentStatus = "open" | "acknowledged" | "resolved";

export interface IRootCause {
  possibleCauses: { cause: string; probability: number }[];
  affectedServices: string[];
  suggestedRemediation: string[];
  confidenceScore: number;
}

export interface IIncident {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  clusterId: Types.ObjectId;
  resourceType: "deployment" | "pod" | "node";
  resourceId: Types.ObjectId;
  resourceName: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  rootCause: IRootCause;
  timeline: { ts: Date; description: string }[];
  openedAt: Date;
  resolvedAt?: Date;
  assignedTo?: Types.ObjectId;
}

const incidentSchema = new Schema<IIncident>({
  orgId: { type: Schema.Types.ObjectId, required: true, index: true },
  clusterId: { type: Schema.Types.ObjectId, required: true, index: true },
  resourceType: { type: String, enum: ["deployment", "pod", "node"], required: true },
  resourceId: { type: Schema.Types.ObjectId, required: true },
  resourceName: { type: String, required: true },
  type: {
    type: String,
    enum: [
      "CrashLoopBackOff",
      "ImagePullBackOff",
      "OOMKilled",
      "NodeNotReady",
      "PodPending",
      "HighRestartRate",
      "CPUSaturation",
      "MemoryPressure",
    ],
    required: true,
  },
  severity: { type: String, enum: ["critical", "high", "medium", "low"], required: true },
  status: { type: String, enum: ["open", "acknowledged", "resolved"], default: "open" },
  rootCause: {
    possibleCauses: [{ cause: String, probability: Number }],
    affectedServices: [String],
    suggestedRemediation: [String],
    confidenceScore: Number,
  },
  timeline: [{ ts: Date, description: String }],
  openedAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date },
  assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
});

incidentSchema.index({ orgId: 1, clusterId: 1, status: 1, severity: 1 });

export const Incident = model<IIncident>("Incident", incidentSchema);
