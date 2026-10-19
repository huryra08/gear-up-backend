import httpStatus from "http-status";
import config from "../config";
import { ApiError } from "../utils/apiError";
//import { ApiError } from "../utils/ApiError";

if (!config.sslcommerz_store_id || !config.sslcommerz_store_password) {
    throw new Error("SSLCOMMERZ_STORE_ID / SSLCOMMERZ_STORE_PASSWORD is missing from .env");
}

const SSLCZ_BASE = config.sslcommerz_is_live
    ? "https://securepay.sslcommerz.com"
    : "https://sandbox.sslcommerz.com";

interface InitSessionParams {
    transactionId: string;
    amount: number;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
}

interface SSLCommerzSession {
    checkoutUrl: string;
    sessionKey: string;
}

/**
 * Initiates an SSLCommerz payment session and returns the GatewayPageURL
 * the customer should be redirected to.
 */
export const initSSLCommerzSession = async (
    params: InitSessionParams
): Promise<SSLCommerzSession> => {
    const body = new URLSearchParams({
        store_id: config.sslcommerz_store_id as string,
        store_passwd: config.sslcommerz_store_password as string,
        total_amount: params.amount.toFixed(2),
        currency: "BDT",
        tran_id: params.transactionId,

        success_url: `${config.app_url}/api/payments/ssl/success`,
        fail_url: `${config.app_url}/api/payments/ssl/fail`,
        cancel_url: `${config.app_url}/api/payments/ssl/cancel`,
        ipn_url: `${config.app_url}/api/payments/ssl/ipn`,

        cus_name: params.customerName,
        cus_email: params.customerEmail,
        cus_phone: params.customerPhone,
        cus_add1: "N/A",
        cus_city: "N/A",
        cus_country: "Bangladesh",

        shipping_method: "NO",
        product_name: "Gear Rental",
        product_category: "Rental",
        product_profile: "general",
    });

    const response = await fetch(`${SSLCZ_BASE}/gwprocess/v4/api.php`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });

    const data = await response.json();

    if (data.status !== "SUCCESS" || !data.GatewayPageURL) {
        throw new ApiError(
            httpStatus.BAD_GATEWAY,
            `Failed to initiate SSLCommerz session: ${data.failedReason || "unknown error"}`
        );
    }

    return {
        checkoutUrl: data.GatewayPageURL,
        sessionKey: data.sessionKey,
    };
};

/**
 * Calls SSLCommerz's Order Validation API using the val_id received on the
 * success callback / IPN. This is the source of truth — never trust the
 * success_url POST body alone, since it can be spoofed by a malicious client.
 */
export const validateSSLCommerzPayment = async (valId: string) => {
    const params = new URLSearchParams({
        val_id: valId,
        store_id: config.sslcommerz_store_id as string,
        store_passwd: config.sslcommerz_store_password as string,
        format: "json",
    });

    const response = await fetch(
        `${SSLCZ_BASE}/validator/api/validationserverAPI.php?${params.toString()}`
    );

    const data = await response.json();
    return data as {
        status: string; // "VALID" | "VALIDATED" | "FAILED" | ...
        tran_id: string;
        val_id: string;
        amount: string;
        currency_type: string;
        card_type?: string;
        [key: string]: unknown;
    };
};
