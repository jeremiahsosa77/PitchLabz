import { it, expect } from "vitest";
import { createApp } from "../apps/api/src/app";
import { readEnv } from "../apps/api/src/env";
const app = createApp(readEnv({ NODE_ENV: "test" }));
it("serves a clearly marked development catalog", async () => {
  const res = await app.request("/api/v1/products");
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.development).toBe(true);
  expect(json.data).toHaveLength(4);
});
it("fails closed when auth is unconfigured", async () => {
  const res = await app.request("/api/v1/hub");
  expect(res.status).toBe(503);
  expect((await res.json()).error.code).toBe("NOT_CONFIGURED");
});
it("does not allow arbitrary CORS origins", async () => {
  const res = await app.request("/api/v1/products", {
    headers: { Origin: "https://attacker.example" },
  });
  expect(res.headers.get("access-control-allow-origin")).not.toBe(
    "https://attacker.example",
  );
});
it("rejects a webhook without configured secrets", async () => {
  const res = await app.request("/api/v1/webhooks/stripe", {
    method: "POST",
    body: "{}",
  });
  expect(res.status).toBe(503);
});
it("rejects unauthenticated background jobs", async () => {
  const res = await app.request("/api/v1/jobs/notifications", {
    method: "POST",
  });
  expect(res.status).toBe(401);
});
it("requires production secrets and rejects live keys in development", () => {
  expect(() => readEnv({ NODE_ENV: "production" })).toThrow();
  expect(() =>
    readEnv({ NODE_ENV: "test", STRIPE_SECRET_KEY: "sk_live_example" }),
  ).toThrow();
});
