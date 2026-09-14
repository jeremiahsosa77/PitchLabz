import { expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { validateWebEnv } from "../apps/web/env-validation";
import { readEnv } from "../apps/api/src/env";
it("requires configured production web and an explicit preview opt-in", () => {
  expect(() => validateWebEnv({ NODE_ENV: "production" })).toThrow(/Missing/);
  expect(() =>
    validateWebEnv({ NODE_ENV: "production", PITCH_PREVIEW_BUILD: "1" }),
  ).not.toThrow();
  expect(() =>
    validateWebEnv({
      NODE_ENV: "production",
      PITCH_PREVIEW_BUILD: "1",
      DEPLOYMENT_ENV: "staging",
    }),
  ).toThrow(/prohibited/);
});
it("blocks secret and legacy service-role browser keys", () => {
  for (const key of [
    "sb_secret_example",
    "x." +
      Buffer.from(JSON.stringify({ role: "service_role" })).toString(
        "base64url",
      ) +
      ".x",
  ])
    expect(() =>
      validateWebEnv({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }),
    ).toThrow();
  expect(() =>
    validateWebEnv({ NEXT_PUBLIC_SUPABASE_SECRET_KEY: "example" }),
  ).toThrow();
});
it("rejects restricted live Stripe keys outside production", () => {
  expect(() =>
    readEnv({ NODE_ENV: "test", STRIPE_SECRET_KEY: "rk_live_example" }),
  ).toThrow();
});
it("browser source cannot import API secrets or administrative Supabase clients", () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? walk(`${dir}/${e.name}`)
        : /\.(ts|tsx)$/.test(e.name)
          ? [`${dir}/${e.name}`]
          : [],
    );
  for (const file of walk("apps/web/src")) {
    const source = readFileSync(file, "utf8");
    expect(source, file).not.toMatch(
      /SUPABASE_SECRET_KEY|SERVICE_ROLE|STRIPE_SECRET_KEY|RESEND_API_KEY|clients\.admin|apps\/api|\.\.\/api\/src/,
    );
  }
});
