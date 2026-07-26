import { Router } from "express";
import authRoutes from "./auth.routes";
import clusterRoutes from "./cluster.routes";
import deploymentRoutes from "./deployment.routes";
import podRoutes from "./pod.routes";
import incidentRoutes from "./incident.routes";
import dashboardRoutes from "./dashboard.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/clusters", clusterRoutes);
router.use("/deployments", deploymentRoutes);
router.use("/pods", podRoutes);
router.use("/incidents", incidentRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;
