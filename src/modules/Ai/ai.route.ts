import { NextFunction, Request, Response, Router } from "express";
import httpStatus from "http-status";
import { auth } from "../../middlewares/auth";
import { aiController } from "./ai.controller";

const router = Router();

// The chat endpoint is public, so cap how often one client can call the paid AI API.
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 15;
const hits = new Map<string, { count: number; resetAt: number }>();

const rateLimit = (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt < now) {
        hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return next();
    }

    entry.count += 1;
    if (entry.count > MAX_REQUESTS) {
        return res.status(httpStatus.TOO_MANY_REQUESTS).json({
            success: false,
            statusCode: httpStatus.TOO_MANY_REQUESTS,
            message: "You are sending messages too fast. Please wait a minute and try again",
        });
    }
    next();
};

router.post("/chat", rateLimit, aiController.chat);
router.get("/insights", auth("ADMIN"), aiController.insights);

export const aiRoutes = router;