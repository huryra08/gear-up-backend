import { Router } from "express";
import { auth } from "../../middlewares/auth";
import { analyticsController } from "./analytics.controller";

const router = Router();

router.get("/admin", auth("ADMIN"), analyticsController.getAdminAnalytics);
router.get("/provider", auth("PROVIDER"), analyticsController.getProviderAnalytics);
router.get("/customer", auth("CUSTOMER"), analyticsController.getCustomerAnalytics);

export const analyticsRoutes = router;