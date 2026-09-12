import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "./env";
import { AppError, query, rpc } from "./db";
type PaymentOrder = {
  id: string;
  customer_id: string;
  athlete_id: string;
  product_id: string;
  total_cents: number;
  status: string;
  checkout_expires_at: string;
  stripe_checkout_session_id: string | null;
};
export function payments(
  env: Env,
  db: SupabaseClient,
  injectedStripe?: Stripe,
) {
  const stripe =
    injectedStripe ||
    (env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null);
  function required() {
    if (!stripe) throw new AppError("NOT_CONFIGURED", 503);
    return stripe;
  }
  async function customer(uid: string) {
    const s = required();
    const p = await query<{ email: string; stripe_customer_id: string | null }>(
      db
        .from("profiles")
        .select("email,stripe_customer_id")
        .eq("id", uid)
        .single(),
    );
    if (p.stripe_customer_id) return p.stripe_customer_id;
    const c = await s.customers.create(
      { email: p.email, metadata: { profile_id: uid } },
      { idempotencyKey: `customer:${uid}` },
    );
    await query(
      db.from("profiles").update({ stripe_customer_id: c.id }).eq("id", uid),
    );
    return c.id;
  }
  return {
    async checkout(
      uid: string,
      input: { athlete_id: string; product_id: string; request_id: string },
    ) {
      const s = required();
      const o = await rpc<PaymentOrder>(db, "reserve_order", {
        u: uid,
        a: input.athlete_id,
        pid: input.product_id,
        req: input.request_id,
      });
      if (o.stripe_checkout_session_id) {
        const session = await s.checkout.sessions.retrieve(
          o.stripe_checkout_session_id,
        );
        if (session.status !== "open" || !session.url)
          throw new AppError(
            "CHECKOUT_CLOSED",
            409,
            "This checkout has ended. Start a new purchase.",
          );
        return { url: session.url };
      }
      const p = await query<{ stripe_price_id: string; product_type: string }>(
        db
          .from("coaching_products")
          .select("stripe_price_id,product_type")
          .eq("id", o.product_id)
          .single(),
      );
      const metadata = { order_id: o.id };
      const session = await s.checkout.sessions.create(
        {
          customer: await customer(uid),
          mode: p.product_type === "premium" ? "subscription" : "payment",
          line_items: [{ price: p.stripe_price_id, quantity: 1 }],
          metadata,
          ...(p.product_type === "premium"
            ? { subscription_data: { metadata } }
            : { payment_intent_data: { metadata } }),
          expires_at: Math.max(
            Math.floor(Date.now() / 1000) + 1800,
            Math.floor(new Date(o.checkout_expires_at).getTime() / 1000),
          ),
          success_url: `${env.APP_URL}/app/billing?checkout=returned`,
          cancel_url: `${env.APP_URL}/app/billing?checkout=cancelled`,
        },
        { idempotencyKey: `checkout:${o.id}` },
      );
      await query(
        db
          .from("orders")
          .update({
            stripe_checkout_session_id: session.id,
            checkout_expires_at: new Date(
              session.expires_at * 1000,
            ).toISOString(),
          })
          .eq("id", o.id),
      );
      return { url: session.url };
    },
    async portal(uid: string) {
      const s = required();
      return {
        url: (
          await s.billingPortal.sessions.create({
            customer: await customer(uid),
            return_url: `${env.APP_URL}/app/billing`,
          })
        ).url,
      };
    },
    async change(
      uid: string,
      bid: string,
      action: "cancel" | "reschedule",
      request_id: string,
      starts_at?: string,
    ) {
      const c = await rpc<{ id: string; fee_cents: number; status: string }>(
        db,
        "prepare_booking_change",
        {
          u: uid,
          bid,
          action_name: action,
          target: starts_at || null,
          req: request_id,
        },
      );
      if (c.fee_cents === 0) {
        await rpc(db, "apply_booking_change", { cid: c.id, paid: false });
        return { status: "applied" };
      }
      if (c.status === "applied") return { status: "applied" };
      const s = required();
      const session = await s.checkout.sessions.create(
        {
          customer: await customer(uid),
          mode: "payment",
          line_items: [
            {
              price_data: {
                currency: "usd",
                unit_amount: c.fee_cents,
                product_data: {
                  name:
                    action === "cancel"
                      ? "Lesson cancellation fee"
                      : "Late rescheduling fee",
                },
              },
              quantity: 1,
            },
          ],
          metadata: { change_id: c.id },
          payment_intent_data: { metadata: { change_id: c.id } },
          expires_at: Math.floor(Date.now() / 1000) + 1800,
          success_url: `${env.APP_URL}/app/lessons?checkout=returned`,
          cancel_url: `${env.APP_URL}/app/lessons`,
        },
        { idempotencyKey: `change:${c.id}` },
      );
      await query(
        db
          .from("booking_changes")
          .update({ stripe_checkout_session_id: session.id })
          .eq("id", c.id),
      );
      return { url: session.url, fee_cents: c.fee_cents };
    },
    async webhook(body: string, signature: string) {
      const s = required();
      if (!env.STRIPE_WEBHOOK_SECRET) throw new AppError("NOT_CONFIGURED", 503);
      let event: Stripe.Event;
      try {
        event = s.webhooks.constructEvent(
          body,
          signature,
          env.STRIPE_WEBHOOK_SECRET,
        );
      } catch {
        throw new AppError(
          "INVALID_SIGNATURE",
          400,
          "Invalid webhook signature.",
        );
      }
      const p: Record<string, unknown> = { event_created: event.created };
      let sid: string | null = null;
      const ref = (v: string | { id: string } | null | undefined) =>
        typeof v === "string" ? v : v?.id || null;
      switch (event.type) {
        case "checkout.session.expired":
          p.order_id = event.data.object.metadata?.order_id;
          break;
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded": {
          const v = event.data.object;
          p.order_id = v.metadata?.order_id;
          p.change_id = v.metadata?.change_id;
          p.paid = v.payment_status === "paid";
          p.amount = v.amount_total;
          p.currency = v.currency;
          p.payment_intent = ref(v.payment_intent);
          sid = ref(v.subscription);
          break;
        }
        case "payment_intent.succeeded":
        case "payment_intent.payment_failed": {
          const v = event.data.object;
          p.order_id = v.metadata.order_id;
          p.change_id = v.metadata.change_id;
          p.paid = event.type === "payment_intent.succeeded";
          p.amount = v.amount_received;
          p.currency = v.currency;
          p.payment_intent = v.id;
          break;
        }
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const v = event.data.object;
          sid = v.id;
          p.order_id = v.metadata.order_id;
          break;
        }
        case "invoice.paid":
        case "invoice.payment_failed": {
          const v = event.data.object;
          sid = ref(v.parent?.subscription_details?.subscription);
          p.order_id = v.parent?.subscription_details?.metadata?.order_id;
          p.invoice_id = v.id;
          p.amount = v.amount_paid;
          p.currency = v.currency;
          p.paid = event.type === "invoice.paid";
          p.grant_cycle = [
            "subscription_create",
            "subscription_cycle",
          ].includes(v.billing_reason || "");
          const line = v.lines.data.find(
            (l) =>
              l.parent?.subscription_item_details &&
              !l.parent.subscription_item_details.proration,
          );
          if (line) {
            p.period_start = new Date(line.period.start * 1000).toISOString();
            p.period_end = new Date(line.period.end * 1000).toISOString();
          }
          break;
        }
        case "charge.refunded": {
          const charge = event.data.object;
          p.payment_intent = ref(charge.payment_intent);
          p.refund_amount = charge.amount_refunded;
          p.charge_id = charge.id;
          if (charge.metadata.order_id) p.order_id = charge.metadata.order_id;
          break;
        }
        default:
          return { received: true, ignored: true };
      }
      if (sid) {
        const sub = await s.subscriptions.retrieve(sid);
        const item = sub.items.data[0];
        if (!item) throw new AppError("INVALID_SUBSCRIPTION", 400);
        p.order_id = sub.metadata.order_id;
        p.subscription_id = sub.id;
        p.subscription_status = sub.status;
        p.period_start ??= new Date(
          item.current_period_start * 1000,
        ).toISOString();
        p.period_end ??= new Date(item.current_period_end * 1000).toISOString();
        p.cancel_at_period_end = sub.cancel_at_period_end;
      }
      const result = await rpc<string>(db, "process_stripe_event", {
        eid: event.id,
        etype: event.type,
        p,
      });
      return { received: true, result };
    },
    async updatePrice(
      product: {
        stripe_product_id: string | null;
        name: string;
        price_cents: number;
        billing_interval: string | null;
      },
      key: string,
    ) {
      const s = required();
      let pid = product.stripe_product_id;
      if (!pid)
        pid = (
          await s.products.create(
            { name: product.name },
            { idempotencyKey: `product:${key}` },
          )
        ).id;
      const price = await s.prices.create(
        {
          product: pid,
          unit_amount: product.price_cents,
          currency: "usd",
          ...(product.billing_interval === "month"
            ? { recurring: { interval: "month" as const } }
            : {}),
        },
        { idempotencyKey: `price:${key}` },
      );
      return { stripe_product_id: pid, stripe_price_id: price.id };
    },
  };
}
