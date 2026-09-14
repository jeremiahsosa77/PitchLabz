import { test, expect } from "@playwright/test";
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
// No default passwords, no production target, no automated customer email.
test.describe("isolated connected staging", () => {
  test.skip(process.env.E2E_LIVE !== "1", "Explicit staging opt-in required");
  test.describe.configure({ mode: "serial" });
  let parent: Actor,
    other: Actor,
    adult: Actor,
    teen: Actor,
    coach: Actor,
    admin: ReturnType<typeof stagingAdmin>;
  let owned: { id: string; first_name: string },
    foreign: { id: string; first_name: string };
  test.beforeAll(async () => {
    stagingEnv();
    admin = stagingAdmin();
    parent = await actor(admin, "parent");
    other = await actor(admin, "parent");
    adult = await actor(admin, "athlete");
    teen = await actor(admin, "teen");
    coach = await actor(admin, "coach");
    owned = await athlete(parent, "Mason staging");
    foreign = await athlete(other, "Other family staging");
  });
  test("parent onboarding is idempotent and cannot escalate roles", async () => {
    expect(
      (
        await call(parent, "/onboarding", {
          role: "admin",
          first_name: "Attack",
          last_name: "Test",
          date_of_birth: "1990-01-01",
        })
      ).status,
    ).toBe(400);
    expect((await (await call(parent, "/me")).json()).data.role).toBe("parent");
  });
  test("parent login, owned workspace, additional athlete and edit", async ({
    page,
  }) => {
    await login(page, parent);
    await expect(page.getByLabel("ATHLETE", { exact: true })).toContainText(
      owned.first_name,
    );
    await page.goto("/app/athletes");
    await page
      .getByRole("button", { name: "Add Athlete", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("First name", { exact: true }).fill("Additional");
    await dialog.getByLabel("Last name", { exact: true }).fill("Fixture");
    await dialog.getByLabel("Birth date").fill("2012-03-22");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const card = page
      .locator(".athlete-card")
      .filter({ hasText: "Additional Fixture" });
    await card.getByRole("button", { name: "Edit profile" }).click();
    await page
      .getByRole("dialog")
      .getByLabel("Development goals")
      .fill("Updated staging goal");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect(card).toContainText("Updated staging goal");
  });
  test("cross-family API and hosted RLS reject reads and mutations", async () => {
    const list = await (await call(parent, "/athletes")).json();
    expect(list.data.some((a: { id: string }) => a.id === foreign.id)).toBe(
      false,
    );
    expect(
      (await call(parent, `/athletes/${foreign.id}`, {}, "PATCH")).status,
    ).toBe(403);
    for (const table of [
      "athletes",
      "service_credits",
      "lesson_bookings",
      "video_submissions",
    ]) {
      const result = await parent.db
        .from(table)
        .select("*")
        .eq(table === "athletes" ? "id" : "athlete_id", foreign.id);
      expect(result.error).toBeNull();
      expect(result.data).toEqual([]);
    }
    expect(
      (
        await parent.db.rpc("process_stripe_event", {
          eid: "forged",
          etype: "invoice.paid",
          p: {},
        })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await parent.db
          .from("profiles")
          .update({ role: "admin" })
          .eq("id", parent.id)
      ).error,
    ).not.toBeNull();
  });
  test("adult login sees only own athlete workspace", async ({ page }) => {
    await login(page, adult);
    const data = await (await call(adult, "/hub")).json();
    expect(data.data.athletes).toHaveLength(1);
    expect(data.data.athletes[0].athlete_user_id).toBe(adult.id);
    const unrelated = await adult.db
      .from("athletes")
      .select("id")
      .eq("id", owned.id);
    expect(unrelated.data).toEqual([]);
    await page.goto("/app/athletes");
    await expect(page.getByRole("button", { name: "Add Athlete" })).toHaveCount(
      0,
    );
  });
  test("guardian invitation links teen and hides parent billing and family controls", async ({
    page,
  }) => {
    const invite = await call(parent, `/athletes/${owned.id}/invite`, {
      email: teen.email,
    });
    expect(invite.status).toBe(200);
    const token = new URL((await invite.json()).url).searchParams.get("invite");
    expect((await call(teen, "/invites/accept", { token })).status).toBe(200);
    expect((await call(teen, "/billing/portal", {})).status).toBe(403);
    const day = new Date().toISOString().slice(0, 10);
    expect(
      (
        await call(coach, "/coach/throwing-plans", {
          athlete_id: owned.id,
          title: "Teen coaching plan",
          description: "Staging published plan",
          start_date: day,
          end_date: day,
          status: "published",
          days: [],
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call(coach, "/coach/notes", {
          athlete_id: owned.id,
          content: "Private staging note",
          visibility: "private",
        })
      ).status,
    ).toBe(200);
    const hub = await (await call(teen, "/hub")).json();
    expect(
      hub.data.plans.some(
        (p: { title: string }) => p.title === "Teen coaching plan",
      ),
    ).toBe(true);
    expect(hub.data.notes).toEqual([]);
    await login(page, teen);
    await page.goto("/app/billing");
    await expect(page.getByRole("button", { name: /Stripe/ })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "unavailable",
    );
    await page.goto("/app/athletes");
    await expect(
      page.getByRole("button", { name: "Edit profile" }),
    ).toHaveCount(0);
    for (const table of ["orders", "subscriptions", "payment_ledger"])
      expect((await teen.db.from(table).select("*")).data).toEqual([]);
  });
  test("all customer routes render real authenticated data without preview fallback", async ({
    page,
  }) => {
    await login(page, parent);
    for (const route of [
      "",
      "athletes",
      "lessons",
      "video",
      "plans",
      "progress",
      "billing",
      "account",
    ]) {
      await page.goto("/app" + (route ? "/" + route : ""));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator(".demo-banner")).toHaveCount(0);
      await expect(page.getByRole("alert")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
    }
  });
  test("coach routes and admin authorization remain distinct", async ({
    page,
  }) => {
    await login(page, coach);
    for (const route of [
      "",
      "calendar",
      "customers",
      "athletes",
      "video",
      "plans",
      "progress",
      "products",
      "revenue",
      "settings",
    ]) {
      await page.goto("/coach" + (route ? "/" + route : ""));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator(".demo-banner")).toHaveCount(0);
    }
    expect((await call(coach, "/coach/revenue")).status).toBe(403);
    expect((await call(coach, "/coach/settings", {}, "PATCH")).status).toBe(
      403,
    );
  });
  test("two real PostgreSQL connections compete for one slot and consume one credit", async () => {
    const day = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    const window = await admin
      .from("availability_exceptions")
      .insert({
        coach_id: coach.id,
        date: day,
        start_time: "10:00",
        end_time: "12:00",
        available: true,
      });
    expect(window.error).toBeNull();
    const products = await admin
      .from("coaching_products")
      .select("id")
      .eq("product_type", "lesson")
      .limit(1);
    expect(products.data?.length).toBe(1);
    const product = products.data![0].id;
    const rows = [
      { who: parent, a: owned },
      { who: other, a: foreign },
    ];
    const batches = rows.map(() => randomUUID());
    for (const [i, row] of rows.entries()) {
      const result = await admin
        .from("service_credits")
        .insert({
          customer_id: row.who.id,
          athlete_id: row.a.id,
          product_id: product,
          credit_batch: batches[i],
          kind: "lesson",
          quantity: 1,
          remaining: 1,
        });
      expect(result.error).toBeNull();
    }
    const slotList = await (
      await call(parent, `/availability?date=${day}&delivery_mode=in_person`)
    ).json();
    const slot = slotList.data.find(
      (s: { coach_id: string }) => s.coach_id === coach.id,
    );
    expect(slot).toBeTruthy();
    const responses = await Promise.all(
      rows.map((row) =>
        call(row.who, "/bookings", {
          athlete_id: row.a.id,
          coach_id: coach.id,
          starts_at: slot.starts_at,
          delivery_mode: "in_person",
          kind: "lesson",
        }),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    const loser = responses.find((r) => r.status === 409)!;
    expect((await loser.json()).error.code).toBe("BOOKING_UNAVAILABLE");
    const credits = await admin
      .from("service_credits")
      .select("remaining")
      .in("credit_batch", batches);
    expect(credits.data?.map((c) => c.remaining).sort()).toEqual([0, 1]);
  });
});
