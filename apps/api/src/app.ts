import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import { z, ZodError } from "zod";
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Profile, Product } from "@pitch/contracts";
import * as v from "@pitch/validation";
import { catalog } from "@pitch/config";
import { AppError, dbClients, query, rpc } from "./db";
import type { Env } from "./env";
import { payments } from "./payments";
import { deliverNotifications } from "./notifications";
type Vars = { user: User; profile: Profile; db: SupabaseClient };
type C = Context<{ Variables: Vars }>;
export function createApp(env: Env, clients = dbClients(env)) {
  const app = new Hono<{ Variables: Vars }>();
  const pay = clients ? payments(env, clients.admin) : null;
  app.use("*", secureHeaders());
  app.use(
    "*",
    cors({
      origin: env.CORS_ORIGIN,
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Authorization", "Content-Type"],
      maxAge: 600,
    }),
  );
  app.use(
    "*",
    bodyLimit({
      maxSize: 256 * 1024,
      onError: (c) =>
        c.json(
          {
            error: {
              code: "BODY_TOO_LARGE",
              message: "This request is too large.",
            },
          },
          413,
        ),
    }),
  );
  app.onError((err, c) => {
    if (err instanceof ZodError)
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: err.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; "),
          },
        },
        400,
      );
    if (err instanceof AppError)
      return c.json(
        { error: { code: err.code, message: err.message } },
        err.status,
      );
    console.error(
      JSON.stringify({
        event: "request_failed",
        path: c.req.path,
        error_type: err.name,
      }),
    );
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Something went wrong. Please try again.",
        },
      },
      500,
    );
  });
  app.notFound((c) =>
    c.json(
      {
        error: { code: "NOT_FOUND", message: "This endpoint does not exist." },
      },
      404,
    ),
  );
  app.get("/health", (c) => c.json({ status: "ok", configured: !!clients }));
  async function attachCapacity(products: Product[]) {
    const rows = await rpc<
      { product_id: string; capacity: number; occupied: number }[]
    >(clients!.admin, "premium_capacity_status");
    for (const p of products) {
      const row = rows.find((r) => r.product_id === p.id);
      if (row) {
        p.full = row.occupied >= row.capacity;
        p.capacity_remaining = Math.max(0, row.capacity - row.occupied);
      }
    }
  }
  app.get("/api/v1/products", async (c) => {
    if (!clients)
      return c.json({
        data: env.NODE_ENV === "production" ? [] : catalog,
        development: true,
      });
    const products = await query<Product[]>(
      clients.admin
        .from("coaching_products")
        .select(
          "id,slug,name,description,product_type,price_cents,billing_interval,benefits,active,display_order,capacity",
        )
        .eq("active", true)
        .order("display_order"),
    );
    await attachCapacity(products);
    return c.json({ data: products });
  });
  app.post("/api/v1/webhooks/stripe", async (c) => {
    if (!pay) throw new AppError("NOT_CONFIGURED", 503);
    return c.json(
      await pay.webhook(
        await c.req.text(),
        c.req.header("stripe-signature") || "",
      ),
    );
  });
  app.post("/api/v1/jobs/notifications", async (c) => {
    if (
      !env.JOB_SECRET ||
      c.req.header("Authorization") !== `Bearer ${env.JOB_SECRET}`
    )
      throw new AppError("UNAUTHENTICATED", 401);
    if (!clients) throw new AppError("NOT_CONFIGURED", 503);
    return c.json(await deliverNotifications(env, clients.admin));
  });
  app.use("/api/v1/*", async (c, next) => {
    if (!clients) throw new AppError("NOT_CONFIGURED", 503);
    const token = c.req.header("Authorization")?.replace(/^Bearer /, "");
    if (!token) throw new AppError("UNAUTHENTICATED", 401);
    const { data, error } = await clients.admin.auth.getUser(token);
    if (error || !data.user || !data.user.email_confirmed_at)
      throw new AppError("UNAUTHENTICATED", 401);
    c.set("user", data.user);
    c.set("db", clients.user(token));
    await next();
  });
  // Bounded per-account limiter. Production edge should additionally limit unauthenticated traffic.
  const buckets = new Map<string, { count: number; until: number }>();
  app.use("/api/v1/*", async (c, next) => {
    if (c.req.method !== "GET") {
      const now = Date.now();
      for (const [k, b] of buckets) if (b.until < now) buckets.delete(k);
      const key = c.get("user").id;
      const b = buckets.get(key) || { count: 0, until: now + 60000 };
      b.count++;
      buckets.set(key, b);
      if (b.count > 30) throw new AppError("RATE_LIMITED", 429);
    }
    await next();
  });
  app.post("/api/v1/onboarding", async (c) => {
    const p = v.onboardingSchema.parse(await c.req.json());
    return c.json({
      data: await rpc(clients!.admin, "onboard", {
        u: c.get("user").id,
        p,
        email_address: c.get("user").email,
      }),
    });
  });
  app.post("/api/v1/invites/accept", async (c) => {
    const p = z
      .object({ token: z.string().min(40).max(200) })
      .strict()
      .parse(await c.req.json());
    return c.json({
      data: await rpc(clients!.admin, "accept_athlete_invite", {
        u: c.get("user").id,
        email_address: c.get("user").email,
        hash: createHash("sha256").update(p.token).digest("hex"),
      }),
    });
  });
  app.use("/api/v1/*", async (c, next) => {
    const { data } = await c
      .get("db")
      .from("profiles")
      .select("*")
      .eq("id", c.get("user").id)
      .maybeSingle();
    if (!data)
      throw new AppError(
        "ONBOARDING_REQUIRED",
        409,
        "Finish setting up your account.",
      );
    c.set("profile", data as Profile);
    await next();
  });
  const actor = (c: C) => c.get("profile").id;
  const staff = (c: C, admin = false) => {
    if (
      !(admin ? ["admin"] : ["coach", "admin"]).includes(c.get("profile").role)
    )
      throw new AppError("FORBIDDEN", 403);
  };
  const owner = async (c: C, a: string) => {
    if (
      !(await rpc<boolean>(clients!.admin, "owns_athlete", { u: actor(c), a }))
    )
      throw new AppError("FORBIDDEN", 403);
  };
  const billing = (c: C) => {
    if (!["parent", "athlete"].includes(c.get("profile").role))
      throw new AppError("FORBIDDEN", 403);
  };
  app.get("/api/v1/me", (c) => c.json({ data: c.get("profile") }));
  app.patch("/api/v1/me", async (c) => {
    const p = z
      .object({
        first_name: z.string().trim().min(1).max(200),
        last_name: z.string().trim().min(1).max(200),
        phone: z.string().max(30).nullable(),
      })
      .strict()
      .parse(await c.req.json());
    return c.json({
      data: await query(
        clients!.admin
          .from("profiles")
          .update(p)
          .eq("id", actor(c))
          .select()
          .single(),
      ),
    });
  });
  app.get("/api/v1/hub", async (c) => {
    const db = c.get("db");
    const read = (table: string, select = "*") =>
      query(db.from(table).select(select).limit(500));
    const [
      athletes,
      bookings,
      credits,
      plans,
      reports,
      videos,
      subscriptions,
      orders,
      notes,
      products,
      settings,
    ] = await Promise.all([
      read("athletes"),
      read("lesson_bookings"),
      read("service_credits"),
      read("throwing_plans", "*,throwing_plan_days(*)"),
      read("progress_reports"),
      read("video_submissions", "*,video_feedback(*)"),
      read("subscriptions"),
      read("orders"),
      read("coach_notes"),
      query<Product[]>(db.from("coaching_products").select("*").limit(500)),
      query<{ value: unknown }>(
        db.from("business_settings").select("value").single(),
      ),
    ]);
    await attachCapacity(products);
    const coaching_status = await rpc(clients!.admin, "coaching_status", {
      u: actor(c),
    });
    return c.json({
      data: {
        coaching_status,
        profile: c.get("profile"),
        athletes,
        bookings,
        credits,
        plans,
        reports,
        videos,
        subscriptions,
        orders,
        notes,
        products,
        settings: settings.value,
      },
    });
  });
  for (const [route, table, select] of [
    ["athletes", "athletes", "*"],
    ["credits", "service_credits", "*"],
    ["bookings", "lesson_bookings", "*"],
    ["plans", "throwing_plans", "*,throwing_plan_days(*)"],
    ["reports", "progress_reports", "*"],
    ["video-submissions", "video_submissions", "*,video_feedback(*)"],
  ] as const) {
    app.get(`/api/v1/${route}`, async (c) =>
      c.json({
        data: await query(c.get("db").from(table).select(select).limit(500)),
      }),
    );
  }
  app.get("/api/v1/athletes/:id", async (c) =>
    c.json({
      data: await query(
        c
          .get("db")
          .from("athletes")
          .select("*")
          .eq("id", v.id.parse(c.req.param("id")))
          .single(),
      ),
    }),
  );
  app.post("/api/v1/athletes", async (c) => {
    if (c.get("profile").role !== "parent")
      throw new AppError("FORBIDDEN", 403);
    const p = v.athleteSchema.parse(await c.req.json());
    return c.json(
      {
        data: await query(
          clients!.admin
            .from("athletes")
            .insert({ ...p, owner_parent_id: actor(c) })
            .select()
            .single(),
        ),
      },
      201,
    );
  });
  app.patch("/api/v1/athletes/:id", async (c) => {
    const id = v.id.parse(c.req.param("id"));
    await owner(c, id);
    const p = v.athleteSchema.parse(await c.req.json());
    return c.json({
      data: await query(
        clients!.admin
          .from("athletes")
          .update(p)
          .eq("id", id)
          .select()
          .single(),
      ),
    });
  });
  app.post("/api/v1/athletes/:id/invite", async (c) => {
    const id = v.id.parse(c.req.param("id"));
    await owner(c, id);
    if (c.get("profile").role !== "parent")
      throw new AppError("FORBIDDEN", 403);
    const { email } = z
      .object({ email: z.string().email() })
      .strict()
      .parse(await c.req.json());
    const a = await query<{
      date_of_birth: string;
      athlete_user_id: string | null;
    }>(
      clients!.admin
        .from("athletes")
        .select("date_of_birth,athlete_user_id")
        .eq("id", id)
        .single(),
    );
    const cutoff = new Date();
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 13);
    if (a.athlete_user_id || new Date(a.date_of_birth) > cutoff)
      throw new AppError("ATHLETE_LOGIN_NOT_ALLOWED", 409);
    const token = randomBytes(32).toString("hex");
    await query(
      clients!.admin.from("athlete_access").insert({
        athlete_id: id,
        invited_email: email,
        invited_by: actor(c),
        token_hash: createHash("sha256").update(token).digest("hex"),
        expires_at: new Date(Date.now() + 86400000 * 7).toISOString(),
      }),
    );
    return c.json({
      url: `${env.APP_URL}/signup?invite=${token}`,
      message:
        "Share this private invitation with your athlete. It expires in seven days.",
    });
  });
  app.post("/api/v1/checkout/session", async (c) => {
    billing(c);
    return c.json(
      await pay!.checkout(actor(c), v.checkoutSchema.parse(await c.req.json())),
    );
  });
  app.post("/api/v1/billing/portal", async (c) => {
    billing(c);
    const owned = await query<{ id: string }[]>(
      clients!.admin
        .from("athletes")
        .select("id")
        .or(
          `owner_parent_id.eq.${actor(c)},and(owner_parent_id.is.null,athlete_user_id.eq.${actor(c)})`,
        ),
    );
    if (!owned.length) throw new AppError("FORBIDDEN", 403);
    return c.json(await pay!.portal(actor(c)));
  });
  app.post("/api/v1/waitlist", async (c) => {
    const p = z
      .object({ athlete_id: v.id, product_id: v.id })
      .strict()
      .parse(await c.req.json());
    await owner(c, p.athlete_id);
    await query(
      clients!.admin
        .from("waitlist")
        .upsert(
          { ...p, customer_id: actor(c) },
          { onConflict: "athlete_id,product_id" },
        ),
    );
    return c.json({ status: "joined" });
  });
  app.get("/api/v1/availability", async (c) => {
    const input = z
      .object({ date: v.date, delivery_mode: z.enum(["online", "in_person"]) })
      .parse(c.req.query());
    return c.json({
      data: await rpc(clients!.admin, "available_slots", {
        day: input.date,
        mode: input.delivery_mode,
      }),
    });
  });
  app.post("/api/v1/bookings", async (c) =>
    c.json(
      {
        data: await rpc(clients!.admin, "book_lesson", {
          u: actor(c),
          p: v.bookingSchema.parse(await c.req.json()),
        }),
      },
      201,
    ),
  );
  app.post("/api/v1/bookings/:id/reschedule", async (c) => {
    const p = v.rescheduleSchema.parse(await c.req.json());
    return c.json(
      await pay!.change(
        actor(c),
        v.id.parse(c.req.param("id")),
        "reschedule",
        p.request_id,
        p.starts_at,
      ),
    );
  });
  app.post("/api/v1/bookings/:id/cancel", async (c) => {
    const p = v.cancelSchema.parse(await c.req.json());
    return c.json(
      await pay!.change(
        actor(c),
        v.id.parse(c.req.param("id")),
        "cancel",
        p.request_id,
      ),
    );
  });
  app.post("/api/v1/video-submissions", async (c) =>
    c.json(
      {
        data: await rpc(clients!.admin, "create_video", {
          u: actor(c),
          p: v.videoSchema.parse(await c.req.json()),
        }),
      },
      201,
    ),
  );
  app.get("/api/v1/video-submissions/:id", async (c) =>
    c.json({
      data: await query(
        c
          .get("db")
          .from("video_submissions")
          .select("*,video_feedback(*)")
          .eq("id", v.id.parse(c.req.param("id")))
          .single(),
      ),
    }),
  );
  app.use("/api/v1/coach/*", async (c, next) => {
    staff(c);
    await next();
  });
  app.post("/api/v1/coach/orders/:id/reconcile", async (c) => {
    staff(c, true);
    return c.json(await pay!.reconcileOrder(v.id.parse(c.req.param("id"))));
  });
  app.get("/api/v1/coach/payment-reviews", async (c) => {
    staff(c, true);
    return c.json({
      data: await query(
        c
          .get("db")
          .from("payment_reviews")
          .select("*")
          .is("resolved_at", null)
          .order("created_at")
          .limit(100),
      ),
    });
  });
  app.get("/api/v1/coach/revenue", async (c) => {
    staff(c, true);
    return c.json({
      data: await rpc(clients!.admin, "revenue_summary", { u: actor(c) }),
    });
  });
  app.get("/api/v1/coach/customers", async (c) =>
    c.json({
      data: await query(
        c
          .get("db")
          .from("profiles")
          .select("id,role,first_name,last_name,email,phone")
          .in("role", ["parent", "athlete"])
          .limit(500),
      ),
    }),
  );
  app.get("/api/v1/coach/activity", async (c) =>
    c.json({
      data: await query(
        c
          .get("db")
          .from("audit_logs")
          .select("action,created_at")
          .order("created_at", { ascending: false })
          .limit(30),
      ),
    }),
  );
  app.get("/api/v1/coach/availability", async (c) =>
    c.json({
      data: await query(c.get("db").from("coach_availability").select("*")),
    }),
  );
  app.post("/api/v1/coach/availability", async (c) =>
    c.json({
      data: await query(
        clients!.admin
          .from("coach_availability")
          .insert({
            ...v.availabilitySchema.parse(await c.req.json()),
            coach_id: actor(c),
          })
          .select()
          .single(),
      ),
    }),
  );
  app.delete("/api/v1/coach/availability/:id", async (c) => {
    await query(
      clients!.admin
        .from("coach_availability")
        .delete()
        .eq("id", v.id.parse(c.req.param("id")))
        .eq("coach_id", actor(c)),
    );
    return c.json({ status: "deleted" });
  });
  app.get("/api/v1/coach/exceptions", async (c) =>
    c.json({
      data: await query(
        c.get("db").from("availability_exceptions").select("*"),
      ),
    }),
  );
  app.post("/api/v1/coach/exceptions", async (c) =>
    c.json({
      data: await query(
        clients!.admin
          .from("availability_exceptions")
          .insert({
            ...v.exceptionSchema.parse(await c.req.json()),
            coach_id: actor(c),
          })
          .select()
          .single(),
      ),
    }),
  );
  app.post("/api/v1/coach/throwing-plans", async (c) =>
    c.json({
      data: await rpc(clients!.admin, "save_coaching", {
        u: actor(c),
        kind: "plan",
        p: v.planSchema.parse(await c.req.json()),
      }),
    }),
  );
  app.patch("/api/v1/coach/throwing-plans/:id", async (c) =>
    c.json({
      data: await rpc(clients!.admin, "save_coaching", {
        u: actor(c),
        kind: "plan",
        rid: v.id.parse(c.req.param("id")),
        p: v.planSchema.parse(await c.req.json()),
      }),
    }),
  );
  app.post("/api/v1/coach/progress-reports", async (c) =>
    c.json({
      data: await rpc(clients!.admin, "save_coaching", {
        u: actor(c),
        kind: "report",
        p: v.reportSchema.parse(await c.req.json()),
      }),
    }),
  );
  app.patch("/api/v1/coach/progress-reports/:id", async (c) =>
    c.json({
      data: await rpc(clients!.admin, "save_coaching", {
        u: actor(c),
        kind: "report",
        rid: v.id.parse(c.req.param("id")),
        p: v.reportSchema.parse(await c.req.json()),
      }),
    }),
  );
  app.post("/api/v1/coach/video-submissions/:id/feedback", async (c) =>
    c.json({
      data: await rpc(clients!.admin, "save_coaching", {
        u: actor(c),
        kind: "feedback",
        rid: v.id.parse(c.req.param("id")),
        p: v.feedbackSchema.parse(await c.req.json()),
      }),
    }),
  );
  app.patch("/api/v1/coach/video-submissions/:id", async (c) => {
    const id = v.id.parse(c.req.param("id"));
    const { status } = z
      .object({ status: z.enum(["received", "in_review", "closed"]) })
      .strict()
      .parse(await c.req.json());
    const result = await rpc(clients!.admin, "set_video_status", {
      u: actor(c),
      vid: id,
      new_status: status,
    });
    return c.json({ data: result });
  });
  app.post("/api/v1/coach/notes", async (c) => {
    const p = v.noteSchema.parse(await c.req.json());
    return c.json({
      data: await query(
        clients!.admin
          .from("coach_notes")
          .insert({ ...p, coach_id: actor(c) })
          .select()
          .single(),
      ),
    });
  });
  app.post("/api/v1/coach/bookings/:id/action", async (c) => {
    const { action } = z
      .object({ action: z.enum(["completed", "no_show", "restore"]) })
      .strict()
      .parse(await c.req.json());
    await rpc(clients!.admin, "coach_booking_action", {
      u: actor(c),
      bid: v.id.parse(c.req.param("id")),
      action_name: action,
    });
    return c.json({ status: "updated" });
  });
  app.patch("/api/v1/coach/bookings/:id", async (c) => {
    const p = v.bookingDetailsSchema.parse(await c.req.json());
    return c.json({
      data: await query(
        clients!.admin
          .from("lesson_bookings")
          .update(p)
          .eq("id", v.id.parse(c.req.param("id")))
          .select()
          .single(),
      ),
    });
  });
  app.patch("/api/v1/coach/settings", async (c) => {
    staff(c, true);
    const p = v.settingsSchema.parse(await c.req.json());
    await query(
      clients!.admin
        .from("business_settings")
        .update({ value: p })
        .eq("id", true),
    );
    await rpc(clients!.admin, "audit", {
      u: actor(c),
      action: "settings_updated",
      resource: "business_settings",
      rid: null,
    });
    return c.json({ data: p });
  });
  app.patch("/api/v1/coach/products/:id", async (c) => {
    staff(c, true);
    const id = v.id.parse(c.req.param("id"));
    const p = v.productUpdateSchema.parse(await c.req.json());
    const old = await query<{
      stripe_product_id: string | null;
      billing_interval: string | null;
      price_cents: number;
      stripe_price_id: string | null;
    }>(
      clients!.admin
        .from("coaching_products")
        .select("*")
        .eq("id", id)
        .single(),
    );
    const mapping =
      old.price_cents !== p.price_cents || !old.stripe_price_id
        ? await pay!.updatePrice({ ...old, ...p }, `${id}:${p.price_cents}`)
        : {};
    await query(
      clients!.admin
        .from("coaching_products")
        .update({ ...p, ...mapping })
        .eq("id", id),
    );
    await rpc(clients!.admin, "audit", {
      u: actor(c),
      action: "product_updated",
      resource: "coaching_products",
      rid: id,
    });
    return c.json({ status: "updated" });
  });
  return app;
}
