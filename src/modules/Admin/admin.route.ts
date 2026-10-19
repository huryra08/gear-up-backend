import { Router } from "express";
import { adminController } from "./admin.controller";
import { auth } from "../../middlewares/auth";

const router = Router();

router.use(auth("ADMIN"));

router.get("/users", adminController.getAllUsers);
router.patch("/users/:id", adminController.updateUserStatus);
router.get("/gear", adminController.getAllGear);
router.get("/rentals", adminController.getAllRentals);
router.get("/stats", adminController.getDashboardStats);

export const adminRoutes = router;
