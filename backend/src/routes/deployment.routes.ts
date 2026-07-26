import { Router } from "express";
import * as deploymentController from "../controllers/deploymentController";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/:depId", deploymentController.getDeployment);
router.get("/:depId/timeline", deploymentController.getDeploymentTimeline);
router.get("/:depId/pods", deploymentController.listPodsForDeployment);

export default router;
