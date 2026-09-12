import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "./env";
export class AppError extends Error {
  constructor(
    public code: string,
    public status: 400 | 401 | 403 | 404 | 409 | 429 | 503 = 400,
    message?: string,
  ) {
    super(message || messages[code] || "Unable to complete this request.");
  }
}
const messages: Record<string, string> = {
  FORBIDDEN: "You do not have access to this resource.",
  UNAUTHENTICATED: "Sign in to continue.",
  NOT_CONFIGURED:
    "This service is awaiting configuration. Please try again later.",
  BOOKING_UNAVAILABLE:
    "That appointment is no longer available. Choose another time.",
  NO_CREDITS:
    "Purchase a valid credit for this athlete and service before continuing.",
  PREMIUM_FULL: "Premium is at capacity. Join the waitlist.",
  PRODUCT_UNAVAILABLE: "This program is not available for checkout yet.",
  PAYMENT_REQUIRED: "Complete the required fee payment to make this change.",
  ADULT_ACCOUNT_REQUIRED:
    "An adult account owner is required. Ask your parent or guardian to register.",
  INVALID_BOOKING_STATE: "This lesson cannot be changed in its current state.",
  RATE_LIMITED: "Too many requests. Please wait a minute and try again.",
};
export function dbClients(env: Env) {
  if (
    !env.SUPABASE_URL ||
    !env.SUPABASE_SECRET_KEY ||
    !env.SUPABASE_PUBLISHABLE_KEY
  )
    return null;
  return {
    admin: createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    user: (jwt: string) =>
      createClient(env.SUPABASE_URL!, env.SUPABASE_PUBLISHABLE_KEY!, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }),
  };
}
export async function query<T>(
  promise: PromiseLike<{
    data: T | null;
    error: { message: string; code?: string } | null;
  }>,
): Promise<T> {
  const { data, error } = await promise;
  if (error) {
    const code = Object.keys(messages).find((k) => error.message.includes(k));
    if (code) throw new AppError(code, code === "FORBIDDEN" ? 403 : 409);
    if (error.code === "23505")
      throw new AppError(
        "CONFLICT",
        409,
        "A request already exists. Refresh and try again.",
      );
    throw new AppError(
      "DATABASE_ERROR",
      503,
      "The request could not be saved. Please try again.",
    );
  }
  return data as T;
}
export async function rpc<T>(
  db: SupabaseClient,
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  return query<T>(db.rpc(name, args));
}
