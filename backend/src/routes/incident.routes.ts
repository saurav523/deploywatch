import { Router } from "express";
import * as incidentController from "../controllers/incidentController";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", incidentController.listIncidents);
router.get("/:id", incidentController.getIncident);
router.patch("/:id", incidentController.patchIncident);

export default router;
