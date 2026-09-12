import { describe, it, expect } from "vitest";
import {
  addMonths,
  changeFee,
  oldestCredit,
  overlaps,
  capacityAvailable,
  entitled,
  canManage,
} from "../apps/api/src/domain";
import { defaults } from "../packages/config/src/index";
import {
  athleteSchema,
  checkoutSchema,
  planSchema,
} from "../packages/validation/src/index";
describe("credit policy", () => {
  it("rolls over one billing cycle and clamps month ends", () => {
    expect(addMonths("2026-10-10T00:00:00Z", 1)).toBe(
      "2026-11-10T00:00:00.000Z",
    );
    expect(addMonths("2026-01-31T00:00:00Z", 1)).toBe(
      "2026-02-28T00:00:00.000Z",
    );
    expect(addMonths("2028-01-31T00:00:00Z", 1)).toBe(
      "2028-02-29T00:00:00.000Z",
    );
  });
  it("selects oldest usable credit with the right service type", () => {
    const c = {
      athlete_id: "a",
      product_id: "p",
      quantity: 4,
      remaining: 1,
      kind: "lesson" as const,
      expires_at: "2026-11-01T00:00:00Z",
    };
    expect(
      oldestCredit(
        [
          { ...c, id: "new", issued_at: "2026-10-01" },
          {
            ...c,
            id: "expired",
            issued_at: "2026-08-01",
            expires_at: "2026-09-01",
          },
          { ...c, id: "old", issued_at: "2026-09-01" },
        ],
        new Date("2026-10-15"),
        "lesson",
      )?.id,
    ).toBe("old");
    expect(
      oldestCredit(
        [{ ...c, id: "x", issued_at: "2026-09-01" }],
        new Date("2026-11-01"),
        "lesson",
      ),
    ).toBeUndefined();
  });
});
describe("booking policy", () => {
  const now = new Date("2026-09-10T12:00:00Z");
  it("48h exactly is free; below is paid", () => {
    expect(changeFee("reschedule", "2026-09-12T12:00:00Z", now, defaults)).toBe(
      0,
    );
    expect(changeFee("reschedule", "2026-09-12T11:59:59Z", now, defaults)).toBe(
      1000,
    );
  });
  it("uses configured cancellation fees", () =>
    expect(
      changeFee("cancel", "2026-10-01T00:00:00Z", now, {
        ...defaults,
        cancellation_fee_cents: 1500,
      }),
    ).toBe(1500));
  it("adjacent sessions do not conflict", () => {
    expect(overlaps({ start: 1, end: 2 }, { start: 2, end: 3 })).toBe(false);
    expect(overlaps({ start: 1, end: 3 }, { start: 2, end: 4 })).toBe(true);
  });
});
describe("entitlements and access", () => {
  it("counts pending holds towards capacity", () => {
    expect(capacityAvailable(10, 2, 12)).toBe(false);
    expect(capacityAvailable(10, 1, 12)).toBe(true);
  });
  it("keeps a three-day failed payment grace period", () => {
    expect(
      entitled(
        "past_due",
        "2026-09-10",
        "2026-09-10",
        3,
        new Date("2026-09-12"),
      ),
    ).toBe(true);
    expect(
      entitled(
        "past_due",
        "2026-09-10",
        "2026-09-10",
        3,
        new Date("2026-09-13"),
      ),
    ).toBe(false);
    expect(
      entitled("canceled", "2026-12-01", null, 3, new Date("2026-09-13")),
    ).toBe(false);
  });
  it("minor cannot control parent billing", () => {
    expect(
      canManage(
        { id: "minor", role: "athlete" },
        { owner_parent_id: "parent", athlete_user_id: "minor" },
      ),
    ).toBe(false);
    expect(
      canManage(
        { id: "parent", role: "parent" },
        { owner_parent_id: "parent", athlete_user_id: "minor" },
      ),
    ).toBe(true);
  });
});
describe("input boundaries", () => {
  it("rejects browser price and status injection", () =>
    expect(
      checkoutSchema.safeParse({
        athlete_id: "30000000-0000-4000-8000-000000000001",
        product_id: "10000000-0000-4000-8000-000000000001",
        request_id: "10000000-0000-4000-8000-000000000005",
        price_cents: 1,
      }).success,
    ).toBe(false));
  it("rejects future birth dates", () =>
    expect(
      athleteSchema.safeParse({
        first_name: "A",
        last_name: "B",
        date_of_birth: "2099-01-01",
        competitive_level: "youth",
        throws: "R",
      }).success,
    ).toBe(false));
  it("rejects days outside the plan range", () =>
    expect(
      planSchema.safeParse({
        athlete_id: "30000000-0000-4000-8000-000000000001",
        title: "Plan",
        description: "",
        start_date: "2026-09-01",
        end_date: "2026-09-07",
        status: "draft",
        days: [
          {
            date: "2026-09-08",
            title: "Day",
            instructions: "",
            intensity: "low",
          },
        ],
      }).success,
    ).toBe(false));
});
