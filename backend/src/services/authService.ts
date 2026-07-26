import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { User, IUser } from "../models/User";
import { AppError } from "../utils/AppError";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";

export async function login(email: string, password: string) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new AppError("Invalid email or password", 401);

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError("Invalid email or password", 401);

  user.lastLoginAt = new Date();
  await user.save();

  return issueTokens(user);
}

export function issueTokens(user: IUser) {
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    orgId: user.orgId.toString(),
    role: user.role,
  });
  const refreshToken = signRefreshToken({ sub: user._id.toString() });
  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.orgId.toString(),
    },
  };
}

export async function refresh(refreshToken: string) {
  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError("Invalid or expired refresh token", 401);
  }
  const user = await User.findById(new Types.ObjectId(payload.sub));
  if (!user) throw new AppError("User no longer exists", 401);
  return issueTokens(user);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}
