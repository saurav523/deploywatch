import { Router } from "express";
import * as dashboardController from "../controllers/dashboardController";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);
router.get("/summary", dashboardController.getSummary);

export default router;
