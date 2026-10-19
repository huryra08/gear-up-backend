import { Router } from "express";
import { rentalOrderController } from "./rentalOrder.controller";
import { auth } from "../../middlewares/auth";

const router = Router();


router.post("/", auth("CUSTOMER"), rentalOrderController.createRentalOrder);


router.get("/", auth("CUSTOMER", "PROVIDER", "ADMIN"), rentalOrderController.getOrders);


router.get("/:id", auth("CUSTOMER", "PROVIDER", "ADMIN"), rentalOrderController.getOrderById);


router.patch("/:id", auth("PROVIDER", "ADMIN"), rentalOrderController.updateOrderStatus);
router.patch("/:id/status", auth("PROVIDER", "ADMIN"), rentalOrderController.updateOrderStatus);

export const rentalOrderRoutes = router;
