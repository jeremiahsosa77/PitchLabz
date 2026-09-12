export default function sitemap() {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return [
    "",
    "/programs",
    "/about",
    "/privacy",
    "/terms",
    "/cancellation",
    "/refund",
  ].map((p) => ({ url: base + p }));
}
