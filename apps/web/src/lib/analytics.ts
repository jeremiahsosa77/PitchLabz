"use client";
type Event =
  | "homepage_viewed"
  | "program_viewed"
  | "testimonial_viewed"
  | "signup_started"
  | "signup_completed"
  | "checkout_started"
  | "checkout_completed"
  | "lesson_booked"
  | "video_analysis_started"
  | "premium_started";
// No properties accepted: athlete information cannot cross this boundary.
export async function track(event: Event) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  const { default: posthog } = await import("posthog-js");
  if (!posthog.__loaded)
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      person_profiles: "never",
      persistence: "memory",
    });
  posthog.capture(event);
}
