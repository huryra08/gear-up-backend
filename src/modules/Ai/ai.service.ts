import httpStatus from "http-status";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/apiError";
import { analyticsService } from "../Analytics/analytics.service";

type ChatMessage = { role: "user" | "assistant"; content: string };

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const callClaude = async (system: string, messages: ChatMessage[], maxTokens: number): Promise<string> => {
    if (!config.ai_api_key) {
        throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, "AI features are not configured on this server");
    }

    const response = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-api-key": config.ai_api_key,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model: config.ai_model, max_tokens: maxTokens, system, messages }),
    });

    if (!response.ok) {
        console.error("AI provider error:", response.status, await response.text());
        throw new ApiError(httpStatus.BAD_GATEWAY, "The AI service is unavailable right now. Please try again shortly");
    }

    const data = (await response.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim();
    if (!text) throw new ApiError(httpStatus.BAD_GATEWAY, "The AI service returned an empty answer");
    return text;
};

const chat = async (messages: ChatMessage[]) => {
    const gear = await prisma.gear.findMany({
        where: { status: "AVAILABLE" },
        select: {
            id: true,
            name: true,
            brand: true,
            pricePerDay: true,
            category: { select: { name: true } },
        },
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        take: 60,
    });

    const catalog = gear
        .map((g) => `- ${g.name}${g.brand ? ` (${g.brand})` : ""} | ${g.category.name} | ${Number(g.pricePerDay)} per day`)
        .join("\n");

    const system = [
        "You are GearUp's assistant. GearUp is a marketplace for renting sports and outdoor gear.",
        "Help visitors find gear to rent, understand how renting works (browse gear, choose dates, pay with Stripe or SSLCommerz, pick up, return, then review), and answer questions about their trip or sport.",
        "Only recommend items from the catalog below, and use the exact item names. If nothing fits, say so; never invent items, prices or policies.",
        "You cannot see anyone's orders or account and cannot take actions. For order or payment problems, tell the user to check their dashboard.",
        "Keep answers short (under 120 words), friendly and plain.",
        "",
        "Available catalog:",
        catalog || "(no gear is listed right now)",
    ].join("\n");

    const reply = await callClaude(system, messages, 500);

    const lower = reply.toLowerCase();
    const suggestions = gear
        .filter((g) => lower.includes(g.name.toLowerCase()))
        .slice(0, 3)
        .map((g) => ({ id: g.id, name: g.name, pricePerDay: Number(g.pricePerDay) }));

    return { reply, suggestions };
};

const getInsights = async () => {
    const analytics = await analyticsService.getAdminAnalytics();
    const generatedAt = new Date().toISOString();

    if (!config.ai_api_key) {
        return { summary: null, aiAvailable: false, anomalies: analytics.anomalies, generatedAt };
    }

    const system = [
        "You are an analyst for GearUp, a sports and outdoor gear rental marketplace.",
        "You get JSON with platform numbers for the last 6 months. Write 3 to 4 short bullet points (each starting with '- ') for the admin: what is going well, what needs attention, and one concrete next step.",
        "Use only the numbers provided. Do not invent figures. If data is thin, say so. Under 110 words in total.",
    ].join("\n");

    const summary = await callClaude(system, [{ role: "user", content: JSON.stringify(analytics) }], 400);
    return { summary, aiAvailable: true, anomalies: analytics.anomalies, generatedAt };
};

export const aiService = { chat, getInsights };