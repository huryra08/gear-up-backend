import cookieParser from "cookie-parser";
import express, { Application, Request, Response } from "express";
import cors from "cors";
import config from "./config";
import { userRouters } from "./modules/User/user.route";
import { authRoutes } from "./modules/auth/auth.routes";
import { categoryRoutes } from "./modules/Category/category.route";
import { gearRoutes } from "./modules/Gear/gear.route";
import { rentalOrderRoutes } from "./modules/RentalOrder/rentalOrder.route";
import { paymentRoutes } from "./modules/Payment/payment.route";
import { reviewRoutes } from "./modules/Review/review.route";
import { adminRoutes } from "./modules/Admin/admin.route";
import { analyticsRoutes } from "./modules/Analytics/analytics.route";
import { aiRoutes } from "./modules/Ai/ai.route";

const app: Application = express();

app.use(cors({
    origin: config.app_url,
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (req: Request, res: Response) => {
    res.send("GearUp API is running");
});




app.use("/api/auth", authRoutes);
app.use("/api/users", userRouters);
app.use("/api/categories", categoryRoutes);
app.use("/api/gear", gearRoutes);
app.use("/api/provider/gear", gearRoutes);
app.use("/api/rentals", rentalOrderRoutes);
app.use("/api/provider/orders", rentalOrderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/ai", aiRoutes);




export default app;
