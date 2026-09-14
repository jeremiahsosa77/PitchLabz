import { expect, it, vi } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createApp } from "../apps/api/src/app";
import { readEnv } from "../apps/api/src/env";
const uid = "20000000-0000-4000-8000-000000000001";
const id = "30000000-0000-4000-8000-000000000001";
function configured(role = "parent", confirmed = true) {
  const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
  const from = vi.fn(() => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: { id: uid, role }, error: null }),
    };
    return chain;
  });
  const client = { from, rpc } as unknown as SupabaseClient;
  const admin = {
    ...client,
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: {
            id: uid,
            email: "test@example.test",
            email_confirmed_at: confirmed ? "2026-01-01" : null,
          } as User,
        },
        error: null,
      })),
    },
  } as unknown as SupabaseClient;
  return {
    rpc,
    from,
    app: createApp(readEnv({ NODE_ENV: "test" }), {
      admin,
      user: () => client,
    }),
  };
}
const headers = {
  Authorization: "Bearer test-session",
  "Content-Type": "application/json",
};
it("rejects unverified Supabase users before reads and commands", async () => {
  const { app, from, rpc } = configured("parent", false);
  expect((await app.request("/api/v1/hub", { headers })).status).toBe(401);
  expect(from).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});
it("rejects cross-family edit and invite before mutation", async () => {
  const { app, rpc } = configured();
  for (const [path, method] of [
    [`/athletes/${id}`, "PATCH"],
    [`/athletes/${id}/invite`, "POST"],
  ])
    expect(
      (await app.request("/api/v1" + path, { method, headers, body: "{}" }))
        .status,
    ).toBe(403);
  expect(rpc).toHaveBeenCalledWith("owns_athlete", { u: uid, a: id });
});
it("checkout price tampering is rejected before reservation", async () => {
  const { app, rpc } = configured();
  expect(
    (
      await app.request("/api/v1/checkout/session", {
        method: "POST",
        headers,
        body: JSON.stringify({
          athlete_id: id,
          product_id: id,
          request_id: id,
          price_cents: 1,
        }),
      })
    ).status,
  ).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
it.each(["parent", "athlete"])(
  "%s cannot mutate coaching data",
  async (role) => {
    const { app, rpc } = configured(role);
    for (const path of [
      "/coach/throwing-plans",
      "/coach/progress-reports",
      "/coach/notes",
      `/coach/bookings/${id}/action`,
    ])
      expect(
        (
          await app.request("/api/v1" + path, {
            method: "POST",
            headers,
            body: "{}",
          })
        ).status,
      ).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  },
);
it.each([
  "/coach/revenue",
  "/coach/payment-reviews",
  "/coach/settings",
  "/coach/products/" + id,
  "/coach/orders/" + id + "/reconcile",
])("coach cannot access admin operation %s", async (path) => {
  const { app, rpc } = configured("coach");
  const method = path.endsWith("reconcile")
    ? "POST"
    : /settings|products/.test(path)
      ? "PATCH"
      : "GET";
  expect(
    (
      await app.request("/api/v1" + path, {
        method,
        headers,
        ...(method !== "GET" ? { body: "{}" } : {}),
      })
    ).status,
  ).toBe(403);
  expect(rpc).not.toHaveBeenCalled();
});
it("private response has defensive headers and exact CORS origin", async () => {
  const { app } = configured();
  const result = await app.request("/api/v1/me", {
    headers: { ...headers, Origin: "https://attacker.example" },
  });
  expect(result.headers.get("x-content-type-options")).toBe("nosniff");
  expect(result.headers.get("access-control-allow-origin")).not.toBe("*");
  expect(result.headers.get("access-control-allow-origin")).not.toBe(
    "https://attacker.example",
  );
});
