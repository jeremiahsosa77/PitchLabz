import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
export async function hardeningChecks(db: PGlite) {
  let count = 0;
  const parent = "20000000-0000-4000-8000-000000000001",
    parentB = "20000000-0000-4000-8000-000000000002",
    adult = "20000000-0000-4000-8000-000000000003",
    coach = "20000000-0000-4000-8000-000000000004",
    minor = "20000000-0000-4000-8000-000000000005";
  const a = "30000000-0000-4000-8000-000000000001",
    other = "30000000-0000-4000-8000-000000000003";
  const lesson = "10000000-0000-4000-8000-000000000001",
    premium = "10000000-0000-4000-8000-000000000003";
  const scalar = async <T>(sql: string, args: unknown[] = []) =>
    Object.values((await db.query<Record<string, T>>(sql, args)).rows[0])[0];
  async function check(name: string, fn: () => Promise<void>) {
    await db.exec("begin");
    try {
      await fn();
      count++;
      console.info(`PASS ${name}`);
    } finally {
      await db.exec("rollback");
    }
  }
  async function user(id: string) {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
    await db.exec("set local role authenticated");
  }
  async function rejected(sql: string, args: unknown[], pattern: RegExp) {
    await db.exec("savepoint rejection");
    await assert.rejects(() => db.query(sql, args), pattern);
    await db.exec("rollback to rejection");
  }
  async function event(type: string, p: object, id = randomUUID()) {
    return scalar<string>("select process_stripe_event($1,$2,$3::jsonb)", [
      id,
      type,
      JSON.stringify(p),
    ]);
  }
  async function order(pid = lesson, price = 4000) {
    return scalar<string>(
      "insert into orders(customer_id,athlete_id,product_id,request_id,total_cents) values($1,$2,$3,$4,$5) returning id",
      [parent, a, pid, randomUUID(), price],
    );
  }
  const starts = await scalar<string>(
    "select ((current_date+8+time '10:00') at time zone 'America/Chicago')::text",
  );
  const booking = {
    athlete_id: a,
    coach_id: coach,
    starts_at: starts,
    delivery_mode: "in_person",
    kind: "lesson",
  };
  const book = () =>
    scalar<string>("select (book_lesson($1,$2::jsonb)).id", [
      parent,
      JSON.stringify(booking),
    ]);

  // Catalog-derived assertions cover every table and every privileged RPC.
  for (const role of ["anon", "authenticated"])
    await check(
      `${role} has no protected table mutations or privileged RPC execution`,
      async () => {
        assert.equal(
          await scalar<number>(
            `select count(*)::int from pg_tables where schemaname='public' and (has_table_privilege($1,quote_ident(schemaname)||'.'||quote_ident(tablename),'INSERT') or has_table_privilege($1,quote_ident(schemaname)||'.'||quote_ident(tablename),'UPDATE') or has_table_privilege($1,quote_ident(schemaname)||'.'||quote_ident(tablename),'DELETE'))`,
            [role],
          ),
          0,
        );
        assert.equal(
          await scalar<number>(
            `select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('owns_athlete','premium_access','assert_owner','audit','notify_customer','onboard','slot_available','book_lesson','prepare_booking_change','apply_booking_change','create_video','reserve_order','process_stripe_event','save_coaching','coach_booking_action','accept_athlete_invite','enqueue_reminders','claim_notifications','available_slots','revenue_summary','coaching_status','premium_capacity_status','set_video_status') and has_function_privilege($1,p.oid,'EXECUTE')`,
            [role],
          ),
          0,
        );
      },
    );
  for (const uid of [parent, minor, adult])
    await check(
      `${uid.slice(-1)} cannot read other family coaching, credits or profile`,
      async () => {
        const cr = await scalar<string>(
          "insert into service_credits(customer_id,athlete_id,product_id,credit_batch,kind,quantity,remaining) values($1,$2,$3,$4,'lesson',1,1) returning id",
          [parentB, other, lesson, randomUUID()],
        );
        await db.query(
          "insert into lesson_bookings(customer_id,athlete_id,coach_id,credit_id,starts_at,ends_at,delivery_mode) values($1,$2,$3,$4,$5,$5::timestamptz+interval '1 hour','online')",
          [parentB, other, coach, cr, starts],
        );
        await db.query(
          "insert into video_submissions(customer_id,athlete_id,submission_channel) values($1,$2,'email')",
          [parentB, other],
        );
        await user(uid);
        for (const table of [
          "athletes",
          "service_credits",
          "lesson_bookings",
          "video_submissions",
        ])
          assert.equal(
            await scalar<number>(
              `select count(*)::int from ${table} where ${table === "athletes" ? "id" : "athlete_id"}=$1`,
              [other],
            ),
            0,
          );
        assert.equal(
          await scalar<number>(
            "select count(*)::int from profiles where id=$1",
            [parentB],
          ),
          0,
        );
      },
    );
  await check(
    "minor cannot read orders, ledger, parent subscriptions or payment reviews",
    async () => {
      await user(minor);
      for (const table of [
        "orders",
        "payment_ledger",
        "subscriptions",
        "payment_reviews",
      ])
        assert.equal(
          await scalar<number>(`select count(*)::int from ${table}`),
          0,
        );
    },
  );
  for (const uid of [parent, minor])
    await check(
      `${uid.slice(-1)} cannot read draft report, feedback, plan days or private notes`,
      async () => {
        const plan = await scalar<string>(
          "insert into throwing_plans(athlete_id,coach_id,title,description,start_date,end_date) values($1,$2,'Hidden','',current_date,current_date) returning id",
          [a, coach],
        );
        await db.query(
          "insert into throwing_plan_days(plan_id,date,title,instructions,intensity) values($1,current_date,'Hidden','','low')",
          [plan],
        );
        const report = await scalar<string>(
          "insert into progress_reports(athlete_id,coach_id,report_period,summary,wins,areas_to_improve,next_focus,coach_notes) values($1,$2,current_date,'Hidden','','','','') returning id",
          [a, coach],
        );
        const video = await scalar<string>(
          "insert into video_submissions(customer_id,athlete_id,submission_channel) values($1,$2,'email') returning id",
          [parent, a],
        );
        await db.query(
          "insert into video_feedback(submission_id,coach_id,summary,mechanical_notes,drill_recommendations) values($1,$2,'Hidden','','')",
          [video, coach],
        );
        await user(uid);
        assert.equal(
          await scalar<number>(
            "select count(*)::int from throwing_plan_days where plan_id=$1",
            [plan],
          ),
          0,
        );
        assert.equal(
          await scalar<number>(
            "select count(*)::int from progress_reports where id=$1",
            [report],
          ),
          0,
        );
        assert.equal(
          await scalar<number>(
            "select count(*)::int from video_feedback where submission_id=$1",
            [video],
          ),
          0,
        );
        assert.equal(
          await scalar<number>(
            "select count(*)::int from coach_notes where visibility='private'",
          ),
          0,
        );
      },
    );
  await check(
    "coach role cannot read financial rows or invoke admin revenue",
    async () => {
      await db.query("update profiles set role='coach' where id=$1", [coach]);
      await rejected("select revenue_summary($1)", [coach], /FORBIDDEN/);
      await user(coach);
      for (const table of [
        "orders",
        "subscriptions",
        "payment_ledger",
        "payment_reviews",
      ])
        assert.equal(
          await scalar<number>(`select count(*)::int from ${table}`),
          0,
        );
    },
  );
  await check("anonymous lacks SELECT on every private table", async () => {
    assert.equal(
      await scalar<number>(
        "select count(*)::int from pg_tables where schemaname='public' and tablename<>'coaching_products' and has_table_privilege('anon',quote_ident(schemaname)||'.'||quote_ident(tablename),'SELECT')",
      ),
      0,
    );
  });
  for (const [label, delta] of [
    ["minimum notice", "now()+interval '1 hour'"],
    ["booking window", "now()+interval '46 days'"],
  ])
    await check(`booking rejects ${label}`, async () => {
      const time = await scalar<string>(`select (${delta})::text`);
      await rejected(
        "select book_lesson($1,$2::jsonb)",
        [parent, JSON.stringify({ ...booking, starts_at: time })],
        /BOOKING_UNAVAILABLE/,
      );
    });
  await check(
    "delivery mode mismatch rejects without consuming credits",
    async () => {
      await db.exec("update coaching_products set delivery_mode='online'");
      await rejected(
        "select book_lesson($1,$2::jsonb)",
        [parent, JSON.stringify(booking)],
        /NO_CREDITS/,
      );
      assert.equal(
        await scalar<number>(
          "select remaining from service_credits where credit_batch='demo-premium'",
        ),
        3,
      );
    },
  );
  await check("expired credits cannot fund a future lesson", async () => {
    await db.query(
      "update service_credits set expires_at=now()+interval '1 day' where athlete_id=$1",
      [a],
    );
    await rejected(
      "select book_lesson($1,$2::jsonb)",
      [parent, JSON.stringify(booking)],
      /NO_CREDITS/,
    );
  });
  await check("free reschedule preserves one consumed credit", async () => {
    const bid = await book();
    const cid = await scalar<string>(
      "select (prepare_booking_change($1,$2,'reschedule',$3::timestamptz+interval '1 hour',$4)).id",
      [parent, bid, starts, randomUUID()],
    );
    assert.equal(
      await scalar<number>(
        "select fee_cents from booking_changes where id=$1",
        [cid],
      ),
      0,
    );
    await db.query("select apply_booking_change($1,false)", [cid]);
    await db.query("select apply_booking_change($1,false)", [cid]);
    assert.equal(
      await scalar<number>(
        "select remaining from service_credits where credit_batch='demo-premium'",
      ),
      2,
    );
  });
  await check("late reschedule requires configured fee", async () => {
    const bid = await book();
    await db.query(
      "update lesson_bookings set starts_at=now()+interval '24 hours',ends_at=now()+interval '25 hours' where id=$1",
      [bid],
    );
    const cid = await scalar<string>(
      "select (prepare_booking_change($1,$2,'reschedule',$3,$4)).id",
      [parent, bid, starts, randomUUID()],
    );
    assert.equal(
      await scalar<number>(
        "select fee_cents from booking_changes where id=$1",
        [cid],
      ),
      1000,
    );
    await rejected(
      "select apply_booking_change($1,false)",
      [cid],
      /PAYMENT_REQUIRED/,
    );
  });
  await check(
    "no-show forfeits credit; coach restore audits exactly once",
    async () => {
      const bid = await book();
      await db.query(
        "update lesson_bookings set starts_at=now()-interval '3 hours',ends_at=now()-interval '2 hours' where id=$1",
        [bid],
      );
      await db.query("select coach_booking_action($1,$2,'no_show')", [
        coach,
        bid,
      ]);
      assert.equal(
        await scalar<number>(
          "select remaining from service_credits where credit_batch='demo-premium'",
        ),
        2,
      );
      await db.query("select coach_booking_action($1,$2,'restore')", [
        coach,
        bid,
      ]);
      await rejected(
        "select coach_booking_action($1,$2,'restore')",
        [coach, bid],
        /INVALID_BOOKING_STATE/,
      );
      assert.equal(
        await scalar<number>(
          "select remaining from service_credits where credit_batch='demo-premium'",
        ),
        3,
      );
      assert.equal(
        await scalar<number>(
          "select count(*)::int from audit_logs where resource_id=$1 and action='booking_restore'",
          [bid],
        ),
        1,
      );
    },
  );
  for (const first of [
    "checkout.session.completed",
    "payment_intent.succeeded",
  ])
    await check(`${first} first: credits and purchase email once`, async () => {
      const id = await order();
      const p = {
        order_id: id,
        paid: true,
        amount: 4000,
        currency: "usd",
        payment_intent: randomUUID(),
      };
      await event(first, p);
      await event(
        first === "checkout.session.completed"
          ? "payment_intent.succeeded"
          : "checkout.session.completed",
        p,
      );
      assert.equal(
        await scalar<number>(
          "select count(*)::int from service_credits where order_id=$1",
          [id],
        ),
        1,
      );
      assert.equal(
        await scalar<number>(
          "select count(*)::int from notifications where dedupe_key=$1",
          ["paid:" + id],
        ),
        1,
      );
    });
  await check(
    "partial refund audits and preserves entitlement; full refund revokes once",
    async () => {
      const id = await order();
      const pi = randomUUID(),
        charge = randomUUID();
      await event("payment_intent.succeeded", {
        order_id: id,
        paid: true,
        amount: 4000,
        currency: "usd",
        payment_intent: pi,
      });
      const refund = {
        payment_intent: pi,
        charge_id: charge,
        refund_amount: 1000,
        full_refund: false,
      };
      const eid = randomUUID();
      assert.equal(
        await event("charge.refunded", refund, eid),
        "review_required",
      );
      assert.equal(await event("charge.refunded", refund, eid), "duplicate");
      assert.equal(
        await scalar<number>(
          "select remaining from service_credits where order_id=$1",
          [id],
        ),
        1,
      );
      assert.equal(
        await scalar<string>("select status from orders where id=$1", [id]),
        "paid",
      );
      assert.equal(
        await scalar<number>(
          "select count(*)::int from payment_reviews where order_id=$1",
          [id],
        ),
        1,
      );
      await event("charge.refunded", {
        ...refund,
        refund_amount: 4000,
        full_refund: true,
      });
      assert.equal(
        await scalar<number>(
          "select remaining from service_credits where order_id=$1",
          [id],
        ),
        0,
      );
      assert.equal(
        await scalar<number>(
          "select amount_cents from payment_ledger where source_key=$1",
          ["refund:" + charge],
        ),
        -4000,
      );
    },
  );
  await check("unknown order and unmatched refund grant nothing", async () => {
    assert.equal(
      await event("payment_intent.succeeded", {
        order_id: randomUUID(),
        paid: true,
      }),
      "ignored",
    );
    assert.equal(
      await event("charge.refunded", {
        charge_id: randomUUID(),
        refund_amount: 100,
        full_refund: false,
      }),
      "review_required",
    );
  });
  await check(
    "expired Premium checkout releases capacity only on verified expiration",
    async () => {
      await db.query("update coaching_products set capacity=1 where id=$1", [
        premium,
      ]);
      await db.exec(
        "update subscriptions set status='canceled'; update orders set status='cancelled' where status='pending'",
      );
      const id = await scalar<string>(
        "select (reserve_order($1,$2,$3,$4)).id",
        [parent, a, premium, randomUUID()],
      );
      await rejected(
        "select reserve_order($1,$2,$3,$4)",
        [parent, a, premium, randomUUID()],
        /PREMIUM_FULL/,
      );
      await event("checkout.session.expired", { order_id: id });
      assert.equal(
        await scalar<string>("select status from orders where id=$1", [id]),
        "cancelled",
      );
      assert.ok(
        await scalar<string>("select (reserve_order($1,$2,$3,$4)).id", [
          parent,
          a,
          premium,
          randomUUID(),
        ]),
      );
    },
  );
  for (const first of ["invoice.paid", "customer.subscription.updated"])
    await check(
      `${first} first; stale updates cannot regress periods`,
      async () => {
        const id = await order(premium, 15000);
        const sid = randomUUID();
        const p = {
          order_id: id,
          subscription_id: sid,
          subscription_status: "active",
          subscription_price_id: "price_premium",
          invoice_price_id: "price_premium",
          period_start: "2026-09-10T00:00:00Z",
          period_end: "2026-10-10T00:00:00Z",
          subscription_period_start: "2026-10-10T00:00:00Z",
          subscription_period_end: "2026-11-10T00:00:00Z",
          event_created: 200,
          paid: true,
          grant_cycle: true,
          invoice_id: randomUUID(),
          amount: 15000,
          currency: "usd",
        };
        await event(first, p);
        await event(
          first === "invoice.paid"
            ? "customer.subscription.updated"
            : "invoice.paid",
          p,
        );
        await event("invoice.paid", p);
        await event("customer.subscription.updated", {
          ...p,
          event_created: 100,
          subscription_status: "past_due",
          subscription_period_end: "2026-09-10T00:00:00Z",
        });
        assert.equal(
          await scalar<string>(
            "select current_period_end::date::text from subscriptions where stripe_subscription_id=$1",
            [sid],
          ),
          "2026-11-10",
        );
        assert.equal(
          await scalar<number>(
            "select count(*)::int from service_credits where order_id=$1",
            [id],
          ),
          1,
        );
        assert.equal(
          await scalar<string>(
            "select expires_at::date::text from service_credits where order_id=$1",
            [id],
          ),
          "2026-11-10",
        );
      },
    );
  await check(
    "Premium price mismatch rolls back event and grants nothing",
    async () => {
      const id = await order(premium, 15000);
      await rejected(
        "select process_stripe_event($1,$2,$3::jsonb)",
        [
          randomUUID(),
          "invoice.paid",
          JSON.stringify({
            order_id: id,
            subscription_id: "bad",
            subscription_price_id: "price_wrong",
          }),
        ],
        /PAYMENT_MISMATCH/,
      );
      assert.equal(
        await scalar<number>(
          "select count(*)::int from service_credits where order_id=$1",
          [id],
        ),
        0,
      );
    },
  );
  await check(
    "failed then paid invoice clears grace; cancellation preserves credits",
    async () => {
      const id = await order(premium, 15000),
        sid = randomUUID(),
        invoice = randomUUID();
      const p = {
        order_id: id,
        subscription_id: sid,
        subscription_price_id: "price_premium",
        invoice_price_id: "price_premium",
        period_start: new Date().toISOString(),
        period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
        event_created: 300,
        paid: false,
        grant_cycle: true,
        invoice_id: invoice,
        amount: 15000,
        currency: "usd",
        subscription_status: "past_due",
      };
      await event("invoice.payment_failed", p);
      await event("invoice.payment_failed", p);
      assert.equal(
        await scalar<boolean>(
          "select payment_failed_at is not null from subscriptions where stripe_subscription_id=$1",
          [sid],
        ),
        true,
      );
      await event("invoice.paid", {
        ...p,
        paid: true,
        event_created: 301,
        subscription_status: "active",
      });
      await event("customer.subscription.updated", {
        ...p,
        paid: false,
        event_created: 302,
        subscription_status: "active",
        cancel_at_period_end: true,
      });
      assert.equal(
        await scalar<boolean>(
          "select payment_failed_at is null and cancel_at_period_end from subscriptions where stripe_subscription_id=$1",
          [sid],
        ),
        true,
      );
      assert.equal(
        await scalar<number>(
          "select remaining from service_credits where order_id=$1",
          [id],
        ),
        4,
      );
      assert.equal(
        await scalar<number>(
          "select count(*)::int from notifications where dedupe_key=$1",
          ["failed:" + invoice],
        ),
        1,
      );
    },
  );
  await check("reminder and publication event keys deduplicate", async () => {
    await db.exec("select enqueue_reminders(); select enqueue_reminders()");
    for (const kind of [
      "lesson_booked",
      "lesson_reminder",
      "lesson_cancel",
      "lesson_reschedule",
      "premium_started",
      "payment_failed",
      "credit_expiration",
      "feedback_published",
      "plan_published",
      "report_published",
    ]) {
      const key = randomUUID();
      await db.query("select notify_customer($1,$2,$3)", [parent, kind, key]);
      await db.query("select notify_customer($1,$2,$3)", [parent, kind, key]);
      assert.equal(
        await scalar<number>(
          "select count(*)::int from notifications where dedupe_key=$1",
          [key],
        ),
        1,
      );
    }
  });
  await check("Chicago DST changes retain local scheduling time", async () => {
    assert.equal(
      await scalar<string>(
        "select (('2026-03-08 10:00'::timestamp at time zone 'America/Chicago') at time zone 'UTC')::text",
      ),
      "2026-03-08 15:00:00",
    );
    assert.equal(
      await scalar<string>(
        "select (('2026-11-01 10:00'::timestamp at time zone 'America/Chicago') at time zone 'UTC')::text",
      ),
      "2026-11-01 16:00:00",
    );
  });
  await check(
    "coaching projection exposes only linked athlete status to teen",
    async () => {
      const rows = await db.query<{
        athlete_id: string;
        premium_active: boolean;
      }>("select * from coaching_status($1)", [minor]);
      assert.deepEqual(rows.rows, [{ athlete_id: a, premium_active: true }]);
      const foreign = await db.query<{ athlete_id: string }>(
        "select * from coaching_status($1)",
        [parentB],
      );
      assert.equal(
        foreign.rows.some((r) => r.athlete_id === a),
        false,
      );
    },
  );
  await check(
    "video receipt commits status, one email and one audit on retries",
    async () => {
      const id = await scalar<string>(
        "insert into video_submissions(customer_id,athlete_id,submission_channel) values($1,$2,'email') returning id",
        [parent, a],
      );
      await rejected(
        "select set_video_status($1,$2,'received')",
        [parent, id],
        /FORBIDDEN/,
      );
      await db.query("select set_video_status($1,$2,'received')", [coach, id]);
      await db.query("select set_video_status($1,$2,'received')", [coach, id]);
      assert.equal(
        await scalar<number>(
          "select count(*)::int from notifications where dedupe_key=$1",
          ["video-received:" + id],
        ),
        1,
      );
      assert.equal(
        await scalar<number>(
          "select count(*)::int from audit_logs where action='video_received' and resource_id=$1",
          [id],
        ),
        1,
      );
      assert.equal(
        await scalar<boolean>(
          "select received_at is not null from video_submissions where id=$1",
          [id],
        ),
        true,
      );
    },
  );
  await check(
    "subscription synchronization does not count the same pending order twice",
    async () => {
      const before = await scalar<number>(
        "select occupied from premium_capacity_status() where product_id=$1",
        [premium],
      );
      await order(premium, 15000);
      assert.equal(
        await scalar<number>(
          "select occupied from premium_capacity_status() where product_id=$1",
          [premium],
        ),
        before,
      );
    },
  );
  await check(
    "reserved Stripe price stays fixed after catalog edits",
    async () => {
      const id = await order(premium, 15000);
      await db.query(
        "update coaching_products set stripe_price_id='price_changed' where id=$1",
        [premium],
      );
      assert.equal(
        await scalar<string>("select stripe_price_id from orders where id=$1", [
          id,
        ]),
        "price_premium",
      );
    },
  );

  await check(
    "draft report can publish on the same ID and repeat without duplicate email",
    async () => {
      const p = {
        athlete_id: a,
        report_period: "2026-09-01",
        summary: "Draft",
        wins: "",
        areas_to_improve: "",
        next_focus: "",
        coach_notes: "",
        publish: false,
      };
      const id = await scalar<string>(
        "select save_coaching($1,'report',$2::jsonb)",
        [coach, JSON.stringify(p)],
      );
      await user(parent);
      assert.equal(
        await scalar<number>(
          "select count(*)::int from progress_reports where id=$1",
          [id],
        ),
        0,
      );
      await db.exec("reset role");
      await rejected(
        "select save_coaching($1,'report',$2::jsonb,$3)",
        [parent, JSON.stringify({ ...p, publish: true }), id],
        /FORBIDDEN/,
      );
      for (let i = 0; i < 2; i++)
        await db.query("select save_coaching($1,'report',$2::jsonb,$3)", [
          coach,
          JSON.stringify({ ...p, summary: "Published", publish: true }),
          id,
        ]);
      assert.equal(
        await scalar<number>(
          "select count(*)::int from notifications where dedupe_key=$1",
          ["report:" + id],
        ),
        1,
      );
      await user(parent);
      assert.equal(
        await scalar<string>(
          "select summary from progress_reports where id=$1",
          [id],
        ),
        "Published",
      );
    },
  );
  await check(
    "actual due reminder and expiry scheduling is idempotent",
    async () => {
      const bid = await book();
      await db.query(
        "update lesson_bookings set starts_at=now()+interval '90 minutes',ends_at=now()+interval '150 minutes',created_at=now()-interval '2 days' where id=$1",
        [bid],
      );
      const cr = await scalar<string>(
        "insert into service_credits(customer_id,athlete_id,product_id,credit_batch,kind,quantity,remaining,expires_at) values($1,$2,$3,$4,'lesson',1,1,now()+interval '6 days 12 hours') returning id",
        [parent, a, lesson, randomUUID()],
      );
      await db.exec("select enqueue_reminders(); select enqueue_reminders()");
      for (const hours of [24, 2])
        assert.equal(
          await scalar<number>(
            "select count(*)::int from notifications where dedupe_key=$1",
            ["reminder:" + bid + ":1:" + hours],
          ),
          1,
        );
      assert.equal(
        await scalar<number>(
          "select count(*)::int from notifications where dedupe_key=$1",
          ["expiry:" + cr + ":7"],
        ),
        1,
      );
    },
  );
  return count;
}
