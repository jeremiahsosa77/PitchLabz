import { it, expect, vi } from "vitest";
import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { payments } from "../apps/api/src/payments";
import { readEnv } from "../apps/api/src/env";
const env = readEnv({
  NODE_ENV: "test",
  STRIPE_SECRET_KEY: "sk_test_example",
  STRIPE_WEBHOOK_SECRET: "whsec_test_only",
});
const stripe = new Stripe("sk_test_example");
function database() {
  const rpc = vi.fn().mockResolvedValue({ data: "processed", error: null });
  return { rpc, db: { rpc } as unknown as SupabaseClient };
}
function signedEvent(type: string, object: unknown) {
  const payload = JSON.stringify({
    id: "evt_signed_test",
    object: "event",
    type,
    created: Math.floor(Date.now() / 1000),
    data: { object },
  });
  return {
    payload,
    signature: stripe.webhooks.generateTestHeaderString({
      payload,
      secret: env.STRIPE_WEBHOOK_SECRET!,
    }),
  };
}
it("verifies a real Stripe signature before the transaction boundary", async () => {
  const { db, rpc } = database();
  const event = signedEvent("payment_intent.succeeded", {
    id: "pi_verified",
    metadata: { order_id: "order" },
    amount_received: 4000,
    currency: "usd",
  });
  await payments(env, db, stripe).webhook(event.payload, event.signature);
  expect(rpc).toHaveBeenCalledWith(
    "process_stripe_event",
    expect.objectContaining({
      etype: "payment_intent.succeeded",
      p: expect.objectContaining({
        paid: true,
        amount: 4000,
        payment_intent: "pi_verified",
      }),
    }),
  );
});
it("rejects tampered webhook body without touching the database", async () => {
  const { db, rpc } = database();
  const event = signedEvent("payment_intent.succeeded", { id: "pi_verified" });
  await expect(
    payments(env, db, stripe).webhook(event.payload + " ", event.signature),
  ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
  expect(rpc).not.toHaveBeenCalled();
});
it("ignores unsupported events without creating entitlements", async () => {
  const { db, rpc } = database();
  const event = signedEvent("customer.created", { id: "cus_test" });
  expect(
    await payments(env, db, stripe).webhook(event.payload, event.signature),
  ).toMatchObject({ ignored: true });
  expect(rpc).not.toHaveBeenCalled();
});
it("checkout resolves database price and stable Stripe idempotency key", async () => {
  const order = {
    id: "order_1",
    customer_id: "parent",
    athlete_id: "athlete",
    product_id: "product",
    total_cents: 4000,
    checkout_expires_at: new Date(Date.now() + 1900000).toISOString(),
    stripe_checkout_session_id: null,
  };
  const rpc = vi.fn().mockResolvedValue({ data: order, error: null });
  const rows: Record<string, unknown> = {
    coaching_products: {
      stripe_price_id: "price_trusted",
      product_type: "lesson",
    },
    profiles: { email: "test@example.test", stripe_customer_id: "cus_test" },
  };
  const from = vi.fn((table: string) => {
    const builder: {
      select: () => unknown;
      eq: () => unknown;
      single: () => Promise<unknown>;
      update: () => unknown;
      then: (resolve: (v: unknown) => unknown) => unknown;
    } = {
      select: () => builder,
      eq: () => builder,
      single: async () => ({ data: rows[table], error: null }),
      update: () => builder,
      then: (resolve) => resolve({ data: null, error: null }),
    };
    return builder;
  });
  const db = { rpc, from } as unknown as SupabaseClient;
  const create = vi
    .spyOn(stripe.checkout.sessions, "create")
    .mockResolvedValue({
      id: "cs_test",
      url: "https://checkout.stripe.com/test",
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    } as Stripe.Response<Stripe.Checkout.Session>);
  const result = await payments(env, db, stripe).checkout("parent", {
    athlete_id: "athlete",
    product_id: "product",
    request_id: "request",
  });
  expect(result.url).toBe("https://checkout.stripe.com/test");
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      line_items: [{ price: "price_trusted", quantity: 1 }],
      payment_intent_data: { metadata: { order_id: "order_1" } },
    }),
    { idempotencyKey: "checkout:order_1" },
  );
  create.mockRestore();
});
