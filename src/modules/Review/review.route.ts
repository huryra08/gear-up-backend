import { Router } from "express";
import { reviewController } from "./review.controller";
import { auth } from "../../middlewares/auth";

const router = Router();

router.post("/", auth("CUSTOMER"), reviewController.createReview);
router.get("/gear/:gearId", reviewController.getReviewsForGear);

export const reviewRoutes = router;
