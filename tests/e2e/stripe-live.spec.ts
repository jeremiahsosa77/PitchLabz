import { test, expect, type Page } from "@playwright/test";
import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import {
  actor,
  athlete,
  call,
  login,
  stagingAdmin,
  stagingEnv,
  type Actor,
} from "./staging-helpers";
import { addMonths } from "../../apps/api/src/domain";
// Hosted Stripe UI may change. This suite is an explicit TEST-only staging gate.
test.describe("Stripe TEST connected checkout and entitlements", () => {
  test.skip(
    process.env.E2E_STRIPE !== "1",
    "Requires E2E_STRIPE=1 as well as isolated staging opt-in",
  );
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120000);
  let stripe: Stripe, admin: ReturnType<typeof stagingAdmin>, parent: Actor;
  test.beforeAll(async () => {
    stagingEnv();
    if (!process.env.E2E_STRIPE_SECRET_KEY?.startsWith("sk_test_"))
      throw new Error("E2E_STRIPE_SECRET_KEY must be a Stripe TEST secret");
    if (!process.env.E2E_STRIPE_WEBHOOK_SECRET?.startsWith("whsec_"))
      throw new Error("Missing staging endpoint E2E_STRIPE_WEBHOOK_SECRET");
    stripe = new Stripe(process.env.E2E_STRIPE_SECRET_KEY);
    admin = stagingAdmin();
    parent = await actor(admin, "parent");
  });
  async function checkout(kind: string) {
    const a = await athlete(parent, `${kind} checkout`);
    const products = await admin
      .from("coaching_products")
      .select("id,stripe_price_id")
      .eq("product_type", kind)
      .eq("active", true)
      .limit(1);
    expect(products.error).toBeNull();
    expect(products.data?.[0]?.stripe_price_id).toBeTruthy();
    const request = randomUUID();
    const response = await call(parent, "/checkout/session", {
      athlete_id: a.id,
      product_id: products.data![0].id,
      request_id: request,
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    const row = await admin
      .from("orders")
      .select("*")
      .eq("request_id", request)
      .single();
    expect(row.error).toBeNull();
    const session = await stripe.checkout.sessions.retrieve(
      row.data.stripe_checkout_session_id,
    );
    expect(session.livemode).toBe(false);
    return {
      a,
      order: row.data as { id: string },
      session,
      url: body.url as string,
    };
  }
  async function pay(page: Page, url: string) {
    await page.goto(url);
    await page.locator('input[name="cardNumber"]').fill("4242424242424242");
    await page.locator('input[name="cardExpiry"]').fill("1230");
    await page.locator('input[name="cardCvc"]').fill("123");
    const name = page.locator('input[name="billingName"]');
    if (await name.count()) await name.fill("Pitch Lab Staging");
    const postal = page.locator('input[name="billingPostalCode"]');
    if (await postal.count()) await postal.fill("60601");
    await page
      .getByRole("button", { name: /^(Pay|Subscribe|Start trial)/ })
      .click();
    await expect(page).toHaveURL(/\/app\/billing\?checkout=returned/, {
      timeout: 60000,
    });
  }
  async function balance(order: string) {
    const result = await admin
      .from("service_credits")
      .select("quantity,remaining,expires_at,credit_batch")
      .eq("order_id", order);
    expect(result.error).toBeNull();
    return result.data!;
  }
  async function replay(type: Stripe.Event.Type, objectId: string) {
    const events = await stripe.events.list({ type, limit: 100 });
    const event = events.data.find(
      (e) => "id" in e.data.object && e.data.object.id === objectId,
    );
    expect(event).toBeTruthy();
    expect(event!.livemode).toBe(false);
    const payload = JSON.stringify(event),
      signature = stripe.webhooks.generateTestHeaderString({
        payload,
        secret: process.env.E2E_STRIPE_WEBHOOK_SECRET!,
      });
    for (let i = 0; i < 2; i++) {
      const response = await fetch(
        `${stagingEnv().api}/api/v1/webhooks/stripe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Stripe-Signature": signature,
          },
          body: payload,
        },
      );
      expect(response.status).toBe(200);
    }
  }
  test("one-time paid Checkout delivers one credit; replay, partial and full refunds are safe", async ({
    page,
  }) => {
    await login(page, parent);
    const c = await checkout("lesson");
    await pay(page, c.url);
    await expect
      .poll(async () => (await balance(c.order.id)).length, { timeout: 60000 })
      .toBe(1);
    await replay("checkout.session.completed", c.session.id);
    expect((await balance(c.order.id))[0].remaining).toBe(1);
    const hub = await (await call(parent, "/hub")).json();
    expect(
      hub.data.credits.some(
        (r: { athlete_id: string; remaining: number }) =>
          r.athlete_id === c.a.id && r.remaining === 1,
      ),
    ).toBe(true);
    const session = await stripe.checkout.sessions.retrieve(c.session.id);
    const pi = session.payment_intent as string;
    await stripe.refunds.create({ payment_intent: pi, amount: 1000 });
    await expect
      .poll(
        async () =>
          (
            await admin
              .from("payment_reviews")
              .select("id")
              .eq("order_id", c.order.id)
          ).data?.length,
        { timeout: 60000 },
      )
      .toBe(1);
    expect((await balance(c.order.id))[0].remaining).toBe(1);
    await stripe.refunds.create({ payment_intent: pi });
    await expect
      .poll(async () => (await balance(c.order.id))[0].remaining, {
        timeout: 60000,
      })
      .toBe(0);
  });
  test("video Checkout grants a usable entitlement consumed by submission", async ({
    page,
  }) => {
    await login(page, parent);
    const c = await checkout("video");
    await pay(page, c.url);
    await expect
      .poll(async () => (await balance(c.order.id)).length, { timeout: 60000 })
      .toBe(1);
    const response = await call(parent, "/video-submissions", {
      athlete_id: c.a.id,
      submission_channel: "email",
      customer_notes: "Fictional metadata only",
    });
    expect(response.status).toBe(201);
    expect((await response.json()).data.reference_code).toMatch(/^PLA-V-/);
    expect((await balance(c.order.id))[0].remaining).toBe(0);
  });
  test("Premium invoice grants four rollover credits, replay stays unique, portal and period-end cancellation work", async ({
    page,
  }) => {
    await login(page, parent);
    const c = await checkout("premium");
    await pay(page, c.url);
    await expect
      .poll(async () => (await balance(c.order.id)).length, { timeout: 60000 })
      .toBe(1);
    const credits = await balance(c.order.id);
    expect(credits[0].quantity).toBe(4);
    const session = await stripe.checkout.sessions.retrieve(c.session.id);
    const sub = await stripe.subscriptions.retrieve(
      session.subscription as string,
    );
    expect(sub.livemode).toBe(false);
    expect(new Date(credits[0].expires_at).toISOString()).toBe(
      addMonths(
        new Date(sub.items.data[0].current_period_end * 1000).toISOString(),
        1,
      ),
    );
    await replay("invoice.paid", sub.latest_invoice as string);
    expect(await balance(c.order.id)).toHaveLength(1);
    const portal = await call(parent, "/billing/portal", {});
    expect(portal.status).toBe(200);
    expect(new URL((await portal.json()).url).hostname).toBe(
      "billing.stripe.com",
    );
    await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
    await expect
      .poll(
        async () =>
          (
            await admin
              .from("subscriptions")
              .select("cancel_at_period_end")
              .eq("stripe_subscription_id", sub.id)
              .single()
          ).data?.cancel_at_period_end,
        { timeout: 60000 },
      )
      .toBe(true);
    expect((await balance(c.order.id))[0].remaining).toBe(4);
  });
  test("expired unpaid Premium Checkout releases the order hold via real webhook", async () => {
    const c = await checkout("premium");
    await stripe.checkout.sessions.expire(c.session.id);
    await expect
      .poll(
        async () =>
          (
            await admin
              .from("orders")
              .select("status")
              .eq("id", c.order.id)
              .single()
          ).data?.status,
        { timeout: 60000 },
      )
      .toBe("cancelled");
    expect(await balance(c.order.id)).toHaveLength(0);
  });
  test("failed renewal starts grace; successful invoice recovery grants one new batch", async ({
    page,
  }) => {
    test.setTimeout(240000);
    const original = parent;
    const clock = await stripe.testHelpers.testClocks.create({
      frozen_time: Math.floor(Date.now() / 1000),
      name: "Pitch Lab staging renewal",
    });
    try {
      parent = await actor(admin, "parent");
      const customer = await stripe.customers.create({
        email: parent.email,
        test_clock: clock.id,
      });
      expect(
        (
          await admin
            .from("profiles")
            .update({ stripe_customer_id: customer.id })
            .eq("id", parent.id)
        ).error,
      ).toBeNull();
      await login(page, parent);
      const c = await checkout("premium");
      await pay(page, c.url);
      await expect
        .poll(async () => (await balance(c.order.id)).length, {
          timeout: 60000,
        })
        .toBe(1);
      const session = await stripe.checkout.sessions.retrieve(c.session.id);
      const sub = await stripe.subscriptions.retrieve(
        session.subscription as string,
      );
      const failure = await stripe.paymentMethods.attach(
        "pm_card_chargeCustomerFail",
        { customer: customer.id },
      );
      await stripe.subscriptions.update(sub.id, {
        default_payment_method: failure.id,
      });
      await stripe.testHelpers.testClocks.advance(clock.id, {
        frozen_time: sub.items.data[0].current_period_end + 60,
      });
      await expect
        .poll(
          async () =>
            (await stripe.testHelpers.testClocks.retrieve(clock.id)).status,
          { timeout: 90000 },
        )
        .toBe("ready");
      await expect
        .poll(
          async () =>
            (
              await admin
                .from("subscriptions")
                .select("payment_failed_at")
                .eq("stripe_subscription_id", sub.id)
                .single()
            ).data?.payment_failed_at,
          { timeout: 60000 },
        )
        .toBeTruthy();
      expect(await balance(c.order.id)).toHaveLength(1);
      const good = await stripe.paymentMethods.attach("pm_card_visa", {
        customer: customer.id,
      });
      const current = await stripe.subscriptions.retrieve(sub.id);
      await stripe.invoices.pay(current.latest_invoice as string, {
        payment_method: good.id,
      });
      await expect
        .poll(async () => (await balance(c.order.id)).length, {
          timeout: 60000,
        })
        .toBe(2);
      expect((await balance(c.order.id)).map((b) => b.quantity)).toEqual([
        4, 4,
      ]);
      await expect
        .poll(
          async () =>
            (
              await admin
                .from("subscriptions")
                .select("payment_failed_at")
                .eq("stripe_subscription_id", sub.id)
                .single()
            ).data?.payment_failed_at,
          { timeout: 60000 },
        )
        .toBeNull();
      await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
    } finally {
      parent = original;
    }
  });
});
