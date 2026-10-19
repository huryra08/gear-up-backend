import httpStatus from "http-status";
import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ApiError } from "../../utils/apiError";
import { aiService } from "./ai.service";

const MAX_MESSAGES = 10;
const MAX_LENGTH = 1000;

const chat = catchAsync(async (req: Request, res: Response) => {
    const raw = req.body?.messages;

    if (!Array.isArray(raw) || raw.length === 0) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Send at least one message");
    }

    const messages = raw.slice(-MAX_MESSAGES).map((m: { role?: unknown; content?: unknown }) => {
        if ((m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string" || !m.content.trim()) {
            throw new ApiError(httpStatus.BAD_REQUEST, "Each message needs a role (user or assistant) and text");
        }
        return { role: m.role as "user" | "assistant", content: m.content.trim().slice(0, MAX_LENGTH) };
    });

    if (messages[0]?.role !== "user" || messages[messages.length - 1]?.role !== "user") {
        throw new ApiError(httpStatus.BAD_REQUEST, "The conversation must start and end with a user message");
    }

    const result = await aiService.chat(messages);
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: "Reply generated", data: result });
});

const insights = catchAsync(async (_req: Request, res: Response) => {
    const result = await aiService.getInsights();
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: "Insights generated", data: result });
});

export const aiController = { chat, insights };