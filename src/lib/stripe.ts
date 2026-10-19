
import Stripe from "stripe";
import config from "../config";

if (!config.stripe_secret_key) {
    throw new Error("STRIPE_SECRET_KEY is missing from .env");
}

export const stripe = new Stripe(config.stripe_secret_key as string, {
  //  apiVersion: "2024-04-10",
});
