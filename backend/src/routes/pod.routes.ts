import { Router } from "express";
import * as podController from "../controllers/podController";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/:id", podController.getPod);
router.get("/:id/logs", podController.getPodLogs);

export default router;
