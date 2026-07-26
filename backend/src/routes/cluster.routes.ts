import { Router } from "express";
import * as clusterController from "../controllers/clusterController";
import * as deploymentController from "../controllers/deploymentController";
import * as podController from "../controllers/podController";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", clusterController.listClusters);
router.get("/:id", clusterController.getCluster);
router.get("/:id/health", clusterController.getClusterHealth);

router.get("/:clusterId/deployments", deploymentController.listDeployments);
router.get("/:clusterId/pods", podController.listPods);

export default router;
