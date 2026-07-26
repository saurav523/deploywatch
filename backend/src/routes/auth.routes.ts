import { Router } from "express";
import * as authController from "../controllers/authController";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.post("/login", authController.login);
router.post("/refresh", authController.refresh);
router.get("/me", requireAuth, authController.me);

export default router;
