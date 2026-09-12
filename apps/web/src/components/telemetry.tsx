"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "../lib/analytics";
export function Telemetry() {
  const path = usePathname();
  useEffect(() => {
    if (path === "/") void track("homepage_viewed");
    if (path === "/programs") void track("program_viewed");
    if (path === "/signup") void track("signup_started");
    const testimonial = document.querySelector(".trust-strip");
    if (!testimonial) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void track("testimonial_viewed");
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(testimonial);
    return () => observer.disconnect();
  }, [path]);
  return null;
}
