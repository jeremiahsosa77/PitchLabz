export function stagingEnv() {
  if (process.env.E2E_LIVE !== "1" || process.env.E2E_TARGET !== "staging")
    throw new Error("Live tests require E2E_LIVE=1 and E2E_TARGET=staging");
  const required = [
    "E2E_BASE_URL",
    "E2E_API_URL",
    "E2E_SUPABASE_URL",
    "E2E_SUPABASE_PROJECT_REF",
    "E2E_SUPABASE_PUBLISHABLE_KEY",
    "E2E_SUPABASE_SECRET_KEY",
  ];
  for (const key of required)
    if (!process.env[key]) throw new Error(`Missing ${key}`);
  const url = process.env.E2E_SUPABASE_URL!;
  if (
    new URL(url).hostname !==
    `${process.env.E2E_SUPABASE_PROJECT_REF}.supabase.co`
  )
    throw new Error(
      "Supabase URL must match the explicitly isolated staging project ref",
    );
  for (const key of ["E2E_BASE_URL", "E2E_API_URL", "E2E_SUPABASE_URL"])
    if (new URL(process.env[key]!).protocol !== "https:")
      throw new Error(`${key} must use HTTPS`);
  return {
    url,
    key: process.env.E2E_SUPABASE_PUBLISHABLE_KEY!,
    secret: process.env.E2E_SUPABASE_SECRET_KEY!,
    api: process.env.E2E_API_URL!,
  };
}
