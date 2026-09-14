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
    stripe_price_id: "price_trusted",
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
it.each([false, true])(
  "refund normalization forwards full_refund=%s",
  async (full) => {
    const { db, rpc } = database();
    const event = signedEvent("charge.refunded", {
      id: "ch_test",
      payment_intent: "pi_test",
      amount: 4000,
      amount_refunded: full ? 4000 : 1000,
      refunded: full,
      metadata: {},
    });
    await payments(env, db, stripe).webhook(event.payload, event.signature);
    expect(rpc).toHaveBeenCalledWith(
      "process_stripe_event",
      expect.objectContaining({
        p: expect.objectContaining({
          full_refund: full,
          refund_amount: full ? 4000 : 1000,
        }),
      }),
    );
  },
);
it("invoice credits use invoice dates while subscription keeps latest retrieved dates", async () => {
  const { db, rpc } = database();
  const retrieve = vi
    .spyOn(stripe.subscriptions, "retrieve")
    .mockResolvedValue({
      id: "sub_test",
      metadata: { order_id: "order" },
      status: "active",
      cancel_at_period_end: false,
      items: {
        data: [
          {
            price: { id: "price_test" },
            current_period_start: 2000000000,
            current_period_end: 2002600000,
          },
        ],
      },
    } as unknown as Stripe.Response<Stripe.Subscription>);
  try {
    const event = signedEvent("invoice.paid", {
      id: "in_test",
      parent: { subscription_details: { subscription: "sub_test" } },
      amount_paid: 15000,
      currency: "usd",
      billing_reason: "subscription_cycle",
      lines: {
        data: [
          {
            parent: { subscription_item_details: { proration: false } },
            pricing: { price_details: { price: "price_test" } },
            period: { start: 1900000000, end: 1902600000 },
          },
        ],
      },
    });
    await payments(env, db, stripe).webhook(event.payload, event.signature);
    expect(rpc).toHaveBeenCalledWith(
      "process_stripe_event",
      expect.objectContaining({
        p: expect.objectContaining({
          invoice_price_id: "price_test",
          subscription_price_id: "price_test",
          period_end: new Date(1902600000 * 1000).toISOString(),
          subscription_period_end: new Date(2002600000 * 1000).toISOString(),
        }),
      }),
    );
  } finally {
    retrieve.mockRestore();
  }
});
it.each(["open", "complete", "expired"])(
  "reconciliation handles %s checkout conservatively",
  async (status) => {
    const rpc = vi.fn().mockResolvedValue({ data: "processed", error: null });
    const row = {
      id: "order_test",
      status: "pending",
      stripe_checkout_session_id: "cs_test",
    };
    const from = () => {
      const b = {
        select: () => b,
        eq: () => b,
        single: async () => ({ data: row, error: null }),
      };
      return b;
    };
    const retrieve = vi
      .spyOn(stripe.checkout.sessions, "retrieve")
      .mockResolvedValue({
        id: "cs_test",
        status,
        metadata: { order_id: row.id },
      } as unknown as Stripe.Response<Stripe.Checkout.Session>);
    try {
      const result = await payments(
        env,
        { rpc, from } as unknown as SupabaseClient,
        stripe,
      ).reconcileOrder(row.id);
      expect(result.status).toBe(status === "expired" ? "cancelled" : status);
      expect(rpc).toHaveBeenCalledTimes(status === "expired" ? 1 : 0);
    } finally {
      retrieve.mockRestore();
    }
  },
);
