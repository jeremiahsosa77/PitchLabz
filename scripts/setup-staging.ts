import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { stagingEnv } from "./staging-env";
import { catalog, defaults } from "../packages/config/src/index";
const env = stagingEnv();
const db = createClient(env.url, env.secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const existing = await db
  .from("profiles")
  .select("id", { count: "exact", head: true });
if (existing.error || existing.count !== 0)
  throw new Error(
    "Setup requires an empty migrated isolated staging project; never reseed customer data",
  );
const settings = await db
  .from("business_settings")
  .upsert({
    id: true,
    value: { ...defaults, business_name: "Pitch Lab Staging" },
  });
if (settings.error) throw new Error("Staging settings setup failed");
const key = process.env.E2E_STRIPE_SECRET_KEY;
if (key && !key.startsWith("sk_test_"))
  throw new Error("Only Stripe sk_test_ keys are accepted");
const stripe = key ? new Stripe(key) : null;
for (const p of catalog) {
  let mapping = {};
  if (stripe) {
    const product = await stripe.products.create({
      name: `STAGING ${p.name}`,
      metadata: {
        pitch_staging_project: process.env.E2E_SUPABASE_PROJECT_REF!,
      },
    });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: p.price_cents,
      currency: "usd",
      ...(p.billing_interval
        ? { recurring: { interval: "month" as const } }
        : {}),
    });
    mapping = { stripe_product_id: product.id, stripe_price_id: price.id };
  }
  const result = await db
    .from("coaching_products")
    .upsert({
      ...p,
      ...mapping,
      credits_per_cycle: p.product_type === "premium" ? 4 : 1,
    });
  if (result.error) throw new Error("Staging catalog setup failed");
}
console.info(
  "Safe staging catalog/settings loaded. Live tests create confirmed fictional users with random passwords; no email is sent by setup.",
);
