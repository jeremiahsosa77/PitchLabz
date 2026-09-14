import { hardeningChecks } from "./db-hardening-checks";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite({ extensions: { pgcrypto, btree_gist } });
let checks = 0;
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  checks++;
  console.info(`PASS ${name}`);
}
async function scalar<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, T>>(sql, params);
  return Object.values(r.rows[0])[0];
}
const parent = "20000000-0000-4000-8000-000000000001",
  minor = "20000000-0000-4000-8000-000000000005",
  coach = "20000000-0000-4000-8000-000000000004",
  a = "30000000-0000-4000-8000-000000000001",
  other = "30000000-0000-4000-8000-000000000003";
try {
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;grant usage on schema public,auth to anon,authenticated,service_role;create table auth.users(id uuid primary key,email text,encrypted_password text,email_confirmed_at timestamptz,raw_app_meta_data jsonb,raw_user_meta_data jsonb,created_at timestamptz,updated_at timestamptz,aud text,role text);create table auth.identities(id uuid,user_id uuid,provider_id text,identity_data jsonb,provider text,created_at timestamptz,updated_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant select on auth.users to service_role;`,
  );
  for (const file of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await db.exec(await readFile("supabase/seed.sql", "utf8"));
  await check("all application tables have RLS", async () =>
    assert.equal(
      await scalar<number>(
        `select count(*)::int from pg_tables where schemaname='public' and not rowsecurity`,
      ),
      0,
    ),
  );
  async function asUser(uid: string) {
    await db.exec("reset role");
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [
      uid,
    ]);
    await db.exec("set role authenticated");
  }
  await asUser(parent);
  await check("parent sees only own athletes", async () =>
    assert.equal(await scalar<number>("select count(*)::int from athletes"), 2),
  );
  await check("parent cannot read another family", async () =>
    assert.equal(
      await scalar<number>("select count(*)::int from athletes where id=$1", [
        other,
      ]),
      0,
    ),
  );
  await check("private coach notes are hidden", async () =>
    assert.equal(
      await scalar<number>("select count(*)::int from coach_notes"),
      0,
    ),
  );
  await check("customer cannot change roles", async () => {
    await assert.rejects(
      () => db.exec(`update profiles set role='admin'`),
      /permission denied/,
    );
  });
  await check("customer cannot invoke privileged credit command", async () => {
    await assert.rejects(
      () => db.query(`select process_stripe_event('fake','invoice.paid','{}')`),
      /permission denied/,
    );
  });
  await check("parent can read published plan days", async () =>
    assert.equal(
      await scalar<number>("select count(*)::int from throwing_plan_days"),
      7,
    ),
  );
  await asUser(minor);
  await check("minor sees own athlete only", async () =>
    assert.equal(await scalar<number>("select count(*)::int from athletes"), 1),
  );
  await check("minor cannot see parent subscriptions", async () =>
    assert.equal(
      await scalar<number>("select count(*)::int from subscriptions"),
      0,
    ),
  );
  await db.exec(
    `reset role;insert into throwing_plans(athlete_id,coach_id,title,description,start_date,end_date,status) values('${a}','${coach}','Private draft','',current_date,current_date+1,'draft');`,
  );
  await asUser(parent);
  await check("draft plan hidden from parent", async () =>
    assert.equal(
      await scalar<number>("select count(*)::int from throwing_plans"),
      1,
    ),
  );
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','',false);set role anon;`,
  );
  await check("anonymous cannot read athletes", async () => {
    await assert.rejects(
      () => db.exec("select * from athletes"),
      /permission denied/,
    );
  });
  await check("anonymous can read catalog", async () =>
    assert.equal(
      await scalar<number>("select count(*)::int from coaching_products"),
      4,
    ),
  );
  await db.exec("reset role");
  await check("cannot create independent minor", async () => {
    await assert.rejects(
      () =>
        db.exec(
          `insert into athletes(athlete_user_id,first_name,last_name,date_of_birth,throws) values('${minor}','Child','Test',current_date-interval '12 years','R')`,
        ),
      /GUARDIAN_REQUIRED/,
    );
  });
  const starts = await scalar<string>(
    `select ((current_date+5+time '10:00') at time zone 'America/Chicago')::text`,
  );
  const booking = {
    athlete_id: a,
    coach_id: coach,
    starts_at: starts,
    delivery_mode: "in_person",
    kind: "lesson",
  };
  let bid = "";
  await check("booking consumes one credit atomically", async () => {
    bid = await scalar<string>(`select (book_lesson($1,$2::jsonb)).id`, [
      parent,
      JSON.stringify(booking),
    ]);
    assert.equal(
      await scalar<number>(
        `select remaining from service_credits where credit_batch='demo-premium'`,
      ),
      2,
    );
  });
  await check("duplicate booking fails without consuming credit", async () => {
    await assert.rejects(
      () =>
        db.query(`select book_lesson($1,$2::jsonb)`, [
          parent,
          JSON.stringify(booking),
        ]),
      /BOOKING_UNAVAILABLE/,
    );
    assert.equal(
      await scalar<number>(
        `select remaining from service_credits where credit_batch='demo-premium'`,
      ),
      2,
    );
  });
  await check("another parent cannot book athlete", async () => {
    await assert.rejects(
      () =>
        db.query(`select book_lesson($1,$2::jsonb)`, [
          "20000000-0000-4000-8000-000000000002",
          JSON.stringify(booking),
        ]),
      /FORBIDDEN/,
    );
  });
  await check(
    "cancellation requires fee and restores exactly once",
    async () => {
      const cid = await scalar<string>(
        `select (prepare_booking_change($1,$2,'cancel',null,gen_random_uuid())).id`,
        [parent, bid],
      );
      await assert.rejects(
        () => db.query("select apply_booking_change($1,false)", [cid]),
        /PAYMENT_REQUIRED/,
      );
      await db.query("select apply_booking_change($1,true)", [cid]);
      await db.query("select apply_booking_change($1,true)", [cid]);
      assert.equal(
        await scalar<number>(
          `select remaining from service_credits where credit_batch='demo-premium'`,
        ),
        3,
      );
    },
  );
  await check(
    "Premium video request does not consume lesson credit",
    async () => {
      await db.query("select create_video($1,$2::jsonb)", [
        parent,
        JSON.stringify({
          athlete_id: a,
          submission_channel: "email",
          customer_notes: "Test",
        }),
      ]);
      assert.equal(
        await scalar<number>(
          `select remaining from service_credits where credit_batch='demo-premium'`,
        ),
        3,
      );
    },
  );
  await check("video without entitlement fails", async () => {
    await assert.rejects(
      () =>
        db.query("select create_video($1,$2::jsonb)", [
          "20000000-0000-4000-8000-000000000002",
          JSON.stringify({
            athlete_id: other,
            submission_channel: "email",
            customer_notes: "",
          }),
        ]),
      /NO_CREDITS/,
    );
  });
  const order = await scalar<string>(
    `insert into orders(customer_id,athlete_id,product_id,request_id,total_cents) values('${parent}','${a}','10000000-0000-4000-8000-000000000001',gen_random_uuid(),4000) returning id`,
  );
  const paid = {
    order_id: order,
    paid: true,
    amount: 4000,
    currency: "usd",
    payment_intent: "pi_test",
  };
  await check("one-time webhook and duplicate event grant once", async () => {
    await db.query("select process_stripe_event($1,$2,$3::jsonb)", [
      "evt_1",
      "payment_intent.succeeded",
      JSON.stringify(paid),
    ]);
    assert.equal(
      await scalar<string>("select process_stripe_event($1,$2,$3::jsonb)", [
        "evt_1",
        "payment_intent.succeeded",
        JSON.stringify(paid),
      ]),
      "duplicate",
    );
    await db.query("select process_stripe_event($1,$2,$3::jsonb)", [
      "evt_2",
      "checkout.session.completed",
      JSON.stringify(paid),
    ]);
    assert.equal(
      await scalar<number>(
        "select count(*)::int from service_credits where order_id=$1",
        [order],
      ),
      1,
    );
  });
  await check("price mismatch rolls back event and entitlements", async () => {
    await assert.rejects(
      () =>
        db.query("select process_stripe_event($1,$2,$3::jsonb)", [
          "evt_bad",
          "payment_intent.succeeded",
          JSON.stringify({ ...paid, amount: 1 }),
        ]),
      /PAYMENT_MISMATCH/,
    );
    assert.equal(
      await scalar<number>(
        `select count(*)::int from stripe_events where stripe_event_id='evt_bad'`,
      ),
      0,
    );
  });
  await db.exec(
    "update coaching_products set stripe_price_id='price_premium' where product_type='premium'",
  );
  const po = await scalar<string>(
    `insert into orders(customer_id,athlete_id,product_id,request_id,total_cents) values('${parent}','${a}','10000000-0000-4000-8000-000000000003',gen_random_uuid(),15000) returning id`,
  );
  const invoice = {
    order_id: po,
    subscription_id: "sub_test",
    subscription_price_id: "price_premium",
    invoice_price_id: "price_premium",
    amount: 15000,
    currency: "usd",
    subscription_status: "active",
    period_start: "2026-09-10T00:00:00Z",
    period_end: "2026-10-10T00:00:00Z",
    event_created: 100,
    paid: true,
    grant_cycle: true,
    invoice_id: "in_test",
  };
  await check(
    "paid Premium cycle grants four with one month rollover",
    async () => {
      await db.query("select process_stripe_event($1,$2,$3::jsonb)", [
        "evt_invoice",
        "invoice.paid",
        JSON.stringify(invoice),
      ]);
      await db.query("select process_stripe_event($1,$2,$3::jsonb)", [
        "evt_invoice_again",
        "invoice.paid",
        JSON.stringify(invoice),
      ]);
      assert.equal(
        await scalar<number>(
          `select quantity from service_credits where credit_batch='invoice:in_test'`,
        ),
        4,
      );
      assert.equal(
        await scalar<string>(
          `select expires_at::date::text from service_credits where credit_batch='invoice:in_test'`,
        ),
        "2026-11-10",
      );
    },
  );
  await check(
    "failed invoice grants no credits and records grace timestamp",
    async () => {
      await db.query("select process_stripe_event($1,$2,$3::jsonb)", [
        "evt_failed",
        "invoice.payment_failed",
        JSON.stringify({
          ...invoice,
          event_created: 101,
          paid: false,
          subscription_status: "past_due",
          invoice_id: "in_failed",
        }),
      ]);
      assert.equal(
        await scalar<number>(
          `select count(*)::int from service_credits where credit_batch='invoice:in_failed'`,
        ),
        0,
      );
      assert.equal(
        await scalar<boolean>(
          `select payment_failed_at is not null from subscriptions where stripe_subscription_id='sub_test'`,
        ),
        true,
      );
    },
  );
  await check("refund revokes unused purchase credits", async () => {
    await db.query("select process_stripe_event($1,$2,$3::jsonb)", [
      "evt_refund",
      "charge.refunded",
      JSON.stringify({
        payment_intent: "pi_test",
        charge_id: "ch_test",
        refund_amount: 4000,
        full_refund: true,
      }),
    ]);
    assert.equal(
      await scalar<number>(
        "select remaining from service_credits where order_id=$1",
        [order],
      ),
      0,
    );
  });
  await check("coach publication is atomic and visible", async () => {
    const id = await scalar<string>("select save_coaching($1,$2,$3::jsonb)", [
      coach,
      "report",
      JSON.stringify({
        athlete_id: a,
        report_period: "2026-09-01",
        summary: "Test published report",
        wins: "Wins",
        areas_to_improve: "Focus",
        next_focus: "Next",
        coach_notes: "Public feedback",
        publish: true,
      }),
    ]);
    await asUser(parent);
    assert.equal(
      await scalar<number>(
        "select count(*)::int from progress_reports where id=$1",
        [id],
      ),
      1,
    );
    await db.exec("reset role");
  });
  await check("notification keys are unique", async () => {
    await db.query(`select notify_customer($1,'welcome','unique-test')`, [
      parent,
    ]);
    await db.query(`select notify_customer($1,'welcome','unique-test')`, [
      parent,
    ]);
    assert.equal(
      await scalar<number>(
        `select count(*)::int from notifications where dedupe_key='unique-test'`,
      ),
      1,
    );
  });
  checks += await hardeningChecks(db);
  console.info(
    `Database: ${checks} checks passed against PostgreSQL WASM with actual migrations, roles, RLS, and transactions.`,
  );
} finally {
  await db.close();
}
