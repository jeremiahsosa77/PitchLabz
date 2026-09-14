import { z } from "zod";
export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(4000),
  APP_URL: z.string().url().default("http://localhost:3000"),
  CORS_ORIGIN: z.string().url().default("http://localhost:3000"),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
  JOB_SECRET: z.string().min(32).optional(),
});
export type Env = z.infer<typeof envSchema>;
export function readEnv(raw: NodeJS.ProcessEnv): Env {
  const env = envSchema.parse(raw);
  if (env.NODE_ENV === "production") {
    for (const key of [
      "SUPABASE_URL",
      "SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SECRET_KEY",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "JOB_SECRET",
      "RESEND_API_KEY",
      "EMAIL_FROM",
    ] as const) {
      if (!env[key]) throw new Error(`Missing ${key}`);
    }
    for (const value of [env.APP_URL, env.CORS_ORIGIN, env.SUPABASE_URL!]) {
      const url = new URL(value);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      )
        throw new Error("Production URLs must be HTTPS origins");
    }
  } else if (/^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY || ""))
    throw new Error("Live Stripe keys are prohibited outside production");
  return env;
}
