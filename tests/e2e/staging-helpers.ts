import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { stagingEnv } from "../../scripts/staging-env";
export { stagingEnv };
export interface Actor {
  id: string;
  email: string;
  password: string;
  token: string;
  db: SupabaseClient;
}
export function stagingAdmin() {
  const e = stagingEnv();
  return createClient(e.url, e.secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function actor(
  admin: SupabaseClient,
  role: "parent" | "athlete" | "coach" | "admin" | "teen",
): Promise<Actor> {
  const marker = await admin.from("business_settings").select("value").single();
  if (marker.error || marker.data?.value?.business_name !== "Pitch Lab Staging")
    throw new Error("Live tests require the safe staging setup marker");
  const e = stagingEnv(),
    run = randomUUID(),
    email = `pitch-e2e-${role}-${run}@example.test`,
    password = `PLA!${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      account_role: role,
      first_name: "Staging",
      last_name: role,
      date_of_birth: "1990-01-01",
    },
  });
  if (error || !data.user)
    throw new Error("Staging Auth fixture creation failed");
  const db = createClient(e.url, e.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const login = await db.auth.signInWithPassword({ email, password });
  if (login.error || !login.data.session)
    throw new Error("Staging Auth fixture login failed");
  const result = {
    id: data.user.id,
    email,
    password,
    token: login.data.session.access_token,
    db,
  };
  if (role !== "teen") {
    const response = await call(result, "/onboarding", {
      role: role === "athlete" ? "athlete" : "parent",
      first_name: "Staging",
      last_name: role,
      date_of_birth: "1990-01-01",
    });
    expect(response.status).toBe(200);
    if (role === "coach" || role === "admin") {
      const updated = await admin
        .from("profiles")
        .update({ role })
        .eq("id", result.id);
      expect(updated.error).toBeNull();
    }
  }
  return result;
}
export async function call(
  who: Actor,
  path: string,
  body?: unknown,
  method = body ? "POST" : "GET",
) {
  return fetch(`${stagingEnv().api}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${who.token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
export async function athlete(who: Actor, name = "Staging athlete") {
  const payload = {
    first_name: name,
    last_name: "Fixture",
    date_of_birth: "2010-05-10",
    competitive_level: "high_school",
    throws: "R",
    goals: "Fictional staging record",
    school: null,
    graduation_year: null,
  };
  const response = await call(who, "/athletes", payload);
  expect(response.status).toBe(201);
  return (await response.json()).data as { id: string; first_name: string };
}
export async function login(page: Page, who: Actor) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(who.email);
  await page.getByLabel("Password", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: /Sign In/ }).click();
  await expect(page).toHaveURL(/\/(app|coach)$/);
}
