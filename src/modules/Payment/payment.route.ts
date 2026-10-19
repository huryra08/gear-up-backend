import express, { Router } from "express";
import { paymentController } from "./payment.controller";
import { auth } from "../../middlewares/auth";

const router = Router();


router.post(
    "/webhook",
    express.raw({ type: "application/json" }),
    paymentController.stripeWebhook
);


router.post("/create", auth("CUSTOMER"), paymentController.createPayment);


router.post("/confirm", paymentController.confirmPayment);


router.post("/ssl/success", paymentController.sslSuccess);
router.post("/ssl/fail", paymentController.sslFail);
router.post("/ssl/cancel", paymentController.sslCancel);
router.post("/ssl/ipn", paymentController.sslIPN);


router.get("/", auth("CUSTOMER", "ADMIN"), paymentController.getMyPayments);
router.get("/:id", auth("CUSTOMER", "ADMIN"), paymentController.getPaymentById);

export const paymentRoutes = router;
