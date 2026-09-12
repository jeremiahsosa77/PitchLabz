import type { Credit, Role, Settings } from "@pitch/contracts";
export function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString();
}
export function changeFee(
  action: "cancel" | "reschedule",
  starts: string,
  now: Date,
  settings: Settings,
): number {
  return action === "cancel"
    ? settings.cancellation_fee_cents
    : new Date(starts).getTime() - now.getTime() >=
        settings.free_reschedule_notice_hours * 3600000
      ? 0
      : settings.late_reschedule_fee_cents;
}
export function oldestCredit(
  credits: Credit[],
  at: Date,
  kind: Credit["kind"],
) {
  return credits
    .filter(
      (c) =>
        c.kind === kind &&
        c.remaining > 0 &&
        (!c.expires_at || new Date(c.expires_at) > at),
    )
    .sort(
      (a, b) =>
        a.issued_at.localeCompare(b.issued_at) || a.id.localeCompare(b.id),
    )[0];
}
export function overlaps(
  a: { start: number; end: number },
  b: { start: number; end: number },
) {
  return a.start < b.end && a.end > b.start;
}
export function capacityAvailable(
  active: number,
  holds: number,
  capacity: number,
) {
  return active + holds < capacity;
}
export function entitled(
  status: string,
  periodEnd: string,
  failedAt: string | null,
  graceDays: number,
  now: Date,
) {
  return ["active", "trialing"].includes(status)
    ? new Date(periodEnd) > now
    : status === "past_due" &&
        !!failedAt &&
        new Date(failedAt).getTime() + graceDays * 86400000 > now.getTime();
}
export function canManage(
  actor: { id: string; role: Role },
  athlete: { owner_parent_id: string | null; athlete_user_id: string | null },
) {
  return actor.role === "parent"
    ? athlete.owner_parent_id === actor.id
    : actor.role === "athlete" &&
        athlete.owner_parent_id === null &&
        athlete.athlete_user_id === actor.id;
}
