import { Response, NextFunction } from "express";
import { z } from "zod";
import * as authService from "../services/authService";
import { AuthedRequest } from "../middleware/auth";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export async function login(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await authService.login(email, password);
    res.json({ data: result, error: null });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await authService.refresh(refreshToken);
    res.json({ data: result, error: null });
  } catch (err) {
    next(err);
  }
}

export async function me(req: AuthedRequest, res: Response) {
  res.json({ data: req.user, error: null });
}
