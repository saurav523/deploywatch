import { Schema, model, Types } from "mongoose";

export type UserRole =
  | "platform_engineer"
  | "devops"
  | "sre"
  | "backend_engineer"
  | "eng_manager"
  | "release_manager"
  | "cloud_admin"
  | "executive";

export interface IUser {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  lastLoginAt?: Date;
}

const userSchema = new Schema<IUser>({
  orgId: { type: Schema.Types.ObjectId, required: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  role: {
    type: String,
    required: true,
    enum: [
      "platform_engineer",
      "devops",
      "sre",
      "backend_engineer",
      "eng_manager",
      "release_manager",
      "cloud_admin",
      "executive",
    ],
  },
  createdAt: { type: Date, default: Date.now },
  lastLoginAt: { type: Date },
});

export const User = model<IUser>("User", userSchema);
