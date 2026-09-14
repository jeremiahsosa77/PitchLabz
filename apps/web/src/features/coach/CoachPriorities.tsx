"use client";
import Link from "next/link";
import type { HubData } from "@pitch/contracts";
import { Panel, Empty } from "@pitch/ui";
import { formatTime } from "../../lib/api";
export function CoachPriorities({
  data,
  prefix,
}: {
  data: HubData;
  prefix: string;
}) {
  const now = new Date();
  const localDay = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  const today = localDay(now),
    month = today.slice(0, 7);
  const sessions = data.bookings
    .filter(
      (b) =>
        b.status === "confirmed" && localDay(new Date(b.starts_at)) === today,
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const names = new Map(
    data.athletes.map((a) => [a.id, `${a.first_name} ${a.last_name}`]),
  );
  const premium = new Set(
    data.coaching_status
      ?.filter((s) => s.premium_active)
      .map((s) => s.athlete_id) ??
      data.subscriptions
        .filter((s) => s.status === "active")
        .map((s) => s.athlete_id),
  );
  const due = data.athletes
    .filter((a) => premium.has(a.id))
    .map((a) => ({
      a,
      plan: !data.plans.some(
        (p) =>
          p.athlete_id === a.id &&
          p.status === "published" &&
          p.start_date <= today &&
          p.end_date >= today,
      ),
      report: !data.reports.some(
        (r) =>
          r.athlete_id === a.id &&
          r.published_at &&
          r.report_period.slice(0, 7) === month,
      ),
    }))
    .filter((r) => r.plan || r.report);
  const urgent = data.videos.filter(
    (v) =>
      v.received_at &&
      ["received", "in_review"].includes(v.status) &&
      (now.getTime() - new Date(v.received_at).getTime()) / 3600000 >=
        data.settings.video_response_target_hours - 5,
  );
  return (
    <>
      <Panel title="Today's lessons">
        {sessions.length ? (
          sessions.map((b) => (
            <p key={b.id}>
              <Link href={`${prefix}/athletes/${b.athlete_id}`}>
                {names.get(b.athlete_id)}
              </Link>{" "}
              · {formatTime(b.starts_at)} · {b.delivery_mode.replace("_", " ")}
            </p>
          ))
        ) : (
          <Empty title="No lessons today">
            Review upcoming appointments in Calendar.
          </Empty>
        )}
      </Panel>
      <Panel title="Coaching priorities">
        {data.products
          .filter(
            (p) =>
              p.product_type === "premium" &&
              p.capacity_remaining !== undefined,
          )
          .map((p) => (
            <p key={p.id}>
              {p.capacity_remaining} Premium places remain, including pending
              checkout holds.
            </p>
          ))}
        {urgent.map((v) => (
          <p className="notice" key={v.id}>
            <Link href={`${prefix}/video`}>
              {v.reference_code} · {names.get(v.athlete_id)}
            </Link>{" "}
            is approaching or past the{" "}
            {data.settings.video_response_target_hours}-hour review target.
          </p>
        ))}
        {due.map(({ a, plan, report }) => (
          <p key={a.id}>
            <Link href={`${prefix}/athletes/${a.id}`}>{names.get(a.id)}</Link> ·{" "}
            {plan ? "Current plan needed. " : ""}
            {report ? "This month’s report is not published." : ""}
          </p>
        ))}
        {!urgent.length && !due.length && (
          <Empty title="No coaching alerts">
            Plan, report and video priorities appear here as work becomes due.
          </Empty>
        )}
      </Panel>
    </>
  );
}
