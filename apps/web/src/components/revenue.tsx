"use client";
import { useState, useEffect } from "react";
import { Panel } from "@pitch/ui";
import { api, dollars } from "../lib/api";
interface Revenue {
  revenue_month_cents: number;
  premium_mrr_cents: number;
  premium_athletes: number;
  lessons_completed: number;
  upcoming_bookings: number;
  outstanding_credits: number;
}
export function RevenuePanel({ demo }: { demo: boolean }) {
  const [data, setData] = useState<Revenue | null>(
    demo
      ? {
          revenue_month_cents: 0,
          premium_mrr_cents: 15000,
          premium_athletes: 1,
          lessons_completed: 0,
          upcoming_bookings: 1,
          outstanding_credits: 3,
        }
      : null,
  );
  const [reviews, setReviews] = useState<
    {
      id: string;
      order_id: string | null;
      reason: string;
      charge_id: string | null;
      amount_cents: number | null;
    }[]
  >([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!demo)
      void api<{ data: typeof reviews }>("/coach/payment-reviews")
        .then((r) => setReviews(r.data))
        .catch((e) => setError(e.message));
    if (!demo)
      void api<{ data: Revenue }>("/coach/revenue")
        .then((r) => setData(r.data))
        .catch((e) => setError(e.message));
  }, [demo]);
  return (
    <Panel title="Business overview">
      <p>
        Amounts reflect confirmed Stripe payment events. Revenue is net of
        synchronized refunds; MRR is an estimate at current catalog pricing.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {reviews.length > 0 && (
        <section aria-label="Payment reviews">
          <h3>Refunds requiring review ({reviews.length})</h3>
          <p>
            Partial refunds preserve entitlements. Review the charge and athlete
            history before making a manual adjustment.
          </p>
          {reviews.map((r) => (
            <article key={r.id} className="report">
              <strong>{r.reason.replaceAll("_", " ")}</strong>
              <p>
                Order: {r.order_id || "Unmatched"} ? Charge:{" "}
                {r.charge_id || "Unknown"}
              </p>
              <p>
                {r.amount_cents === null
                  ? "Review Stripe amount"
                  : dollars(r.amount_cents)}
              </p>
            </article>
          ))}
        </section>
      )}
      {data ? (
        <div className="metric-grid">
          {[
            ["Net revenue this month", dollars(data.revenue_month_cents)],
            ["Premium MRR estimate", dollars(data.premium_mrr_cents)],
            ["Active Premium athletes", data.premium_athletes],
            ["Lessons completed", data.lessons_completed],
            ["Upcoming sessions", data.upcoming_bookings],
            ["Outstanding training credits", data.outstanding_credits],
          ].map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
      ) : (
        !error && <p role="status">Loading revenue…</p>
      )}
    </Panel>
  );
}
