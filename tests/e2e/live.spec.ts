import { test, expect } from "@playwright/test";
// Explicit opt-in: runs only against an isolated, seeded Supabase/Stripe TEST environment.
test.describe("configured Supabase staging", () => {
  test.skip(
    process.env.E2E_LIVE !== "1",
    "Set E2E_LIVE=1 and test credentials to exercise real authentication.",
  );
  test("parent logs in and sees owned athletes", async ({ page }) => {
    await page.goto("/login");
    await page
      .getByLabel("Email address")
      .fill(process.env.E2E_PARENT_EMAIL || "parent-a@example.test");
    await page
      .getByLabel("Password", { exact: true })
      .fill(process.env.E2E_PASSWORD || "PitchLabDemo!2026");
    await page.getByRole("button", { name: "Sign In", exact: false }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByLabel("ATHLETE", { exact: true })).toContainText(
      "Mason Johnson",
    );
  });
  test("coach logs in to restricted workspace", async ({ page }) => {
    await page.goto("/login");
    await page
      .getByLabel("Email address")
      .fill(process.env.E2E_COACH_EMAIL || "coach@example.test");
    await page
      .getByLabel("Password", { exact: true })
      .fill(process.env.E2E_PASSWORD || "PitchLabDemo!2026");
    await page.getByRole("button", { name: "Sign In", exact: false }).click();
    await expect(page).toHaveURL(/\/coach$/);
    await expect(
      page.getByRole("heading", { name: "Let’s get to work, Jacob." }),
    ).toBeVisible();
  });
});
