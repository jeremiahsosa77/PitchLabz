/** Runs at build/start configuration time; errors never include credential values. */
export function validateWebEnv(env: NodeJS.ProcessEnv) {
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (key) {
    let role = "";
    if (key.split(".").length === 3) {
      try {
        role = JSON.parse(
          Buffer.from(key.split(".")[1], "base64url").toString(),
        ).role;
      } catch {
        throw new Error("Invalid public Supabase key");
      }
    }
    if (
      key.startsWith("sb_secret_") ||
      role === "service_role" ||
      (!key.startsWith("sb_publishable_") && role !== "anon")
    )
      throw new Error("Browser Supabase key must be publishable or anon");
  }
  for (const name of Object.keys(env)) {
    if (
      name.startsWith("NEXT_PUBLIC_") &&
      /SECRET|SERVICE_ROLE|PASSWORD|PRIVATE_KEY/.test(name)
    )
      throw new Error("Server secret cannot use a NEXT_PUBLIC_ variable");
  }
  if (env.NODE_ENV !== "production") return;
  if (env.PITCH_PREVIEW_BUILD === "1") {
    if (
      env.VERCEL_ENV === "production" ||
      env.DEPLOYMENT_ENV === "production" ||
      env.DEPLOYMENT_ENV === "staging"
    )
      throw new Error("Preview builds are prohibited on connected deployments");
    return;
  }
  for (const name of [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_API_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "API_URL",
  ]) {
    const value = env[name];
    if (!value)
      throw new Error(
        `Missing ${name}; use PITCH_PREVIEW_BUILD=1 only for a non-connected review build`,
      );
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error(`${name} must be an HTTPS origin`);
  }
  if (!key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}
