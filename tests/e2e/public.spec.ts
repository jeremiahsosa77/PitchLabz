import { test, expect } from "@playwright/test";
test("public coaching catalog follows PRD and navigation works", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Build the pitcher you’re capable of becoming.",
  );
  await expect(
    page.getByText("PLACEHOLDER TESTIMONIAL", { exact: false }),
  ).toBeVisible();
  if (isMobile) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Programs", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Premium Coaching", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("$150", { exact: false })).toBeVisible();
  await expect(page.getByText("AI velocity", { exact: false })).toHaveCount(0);
});
test("athlete preview switches between family members", async ({ page }) => {
  await page.goto("/preview");
  await expect(
    page.getByRole("heading", { name: "Welcome back, Sarah." }),
  ).toBeVisible();
  await page
    .getByLabel("ATHLETE", { exact: true })
    .selectOption({ label: "Luke Johnson" });
  await expect(
    page.getByRole("heading", { name: "Your next session is ahead" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your next plan is ahead" }),
  ).toBeVisible();
});
test("preview payment action is disabled without creating fake success", async ({
  page,
}) => {
  await page.goto("/preview/billing");
  await page
    .getByRole("button", { name: "Choose Program", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: /Continue to Stripe/ }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "read-only development preview",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("coach workspace opens athlete history and plan form", async ({
  page,
}) => {
  await page.goto("/preview/coach/athletes");
  await page.getByRole("link", { name: "Open Workspace" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Coach notes", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create Plan", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Plan title", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Day 1 instructions", { exact: true }),
  ).toBeVisible();
});
test("video handoff has no file upload control", async ({ page }) => {
  await page.goto("/preview/video");
  await expect(
    page.getByRole("heading", { name: "Video analysis", exact: true }),
  ).toBeVisible();
  await expect(page.locator("input[type=file]")).toHaveCount(0);
  await page.getByRole("button", { name: "Send Video", exact: true }).click();
  await expect(
    page.getByLabel("What would you like Jacob to look at?"),
  ).toBeVisible();
});
test("responsive pages have no horizontal overflow at required widths", async ({
  page,
}) => {
  for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/preview",
      "/preview/coach/athletes",
      "/signup",
    ]) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow, `${route} at ${width}px`).toBe(false);
    }
  }
});
