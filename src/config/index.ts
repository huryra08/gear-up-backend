import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
    port: process.env.PORT,
    database_Url: process.env.DATABASE_URL,
    app_url: process.env.APP_URL,
    bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
    jwt_access_secret: process.env.JWT_ACCESS_SECRET!,
    jwt_refresh_secret: process.env.JWT_REFRESH_SECRET!,
    jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRATION_IN!,
    jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRATION_IN!,

    stripe_secret_key: process.env.STRIPE_SECRET_KEY,
    stripe_product_key : process.env.STRIPE_PRODUCT_ID,
    stripe_webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,

    sslcommerz_store_id: process.env.SSLCOMMERZ_STORE_ID,
    sslcommerz_store_password: process.env.SSLCOMMERZ_STORE_PASSWORD,
    sslcommerz_is_live: process.env.SSLCOMMERZ_IS_LIVE === "true",
        ai_api_key: process.env.AI_API_KEY,
    ai_model: process.env.AI_MODEL || "claude-sonnet-5-5",
}
