"use client";
import { Button, Panel, Empty, Badge } from "@pitch/ui";
import { Plus, Printer } from "lucide-react";
import type { PanelContext } from "../../components/hub-types";
export function ThrowingPlansPanel({
  coach,
  plans,
  createPlan,
}: Pick<PanelContext, "coach" | "plans" | "createPlan">) {
  return (
    <Panel
      title="Throwing plans"
      action={
        coach ? (
          <Button onClick={() => createPlan()}>
            <Plus size={16} /> Create Plan
          </Button>
        ) : (
          <button onClick={() => window.print()} className="text-link">
            <Printer size={16} /> Print / Save PDF
          </button>
        )
      }
    >
      {plans.length ? (
        plans.map((p) => (
          <article className="plan" key={p.id}>
            <div className="panel-heading">
              <div>
                <Badge>{p.status}</Badge>
                <h3>{p.title}</h3>
              </div>
              {coach && (
                <button onClick={() => createPlan(p)}>Edit plan</button>
              )}
            </div>
            <p>{p.description}</p>
            <div className="week-grid">
              {p.throwing_plan_days
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((d) => (
                  <div
                    className={`plan-day ${d.intensity}`}
                    key={d.date + d.title}
                  >
                    <p className="eyebrow">
                      {new Date(d.date + "T12:00:00Z").toLocaleDateString(
                        "en-US",
                        { weekday: "short" },
                      )}
                    </p>
                    <h4>{d.title}</h4>
                    <p>{d.instructions}</p>
                    <Badge>{d.intensity}</Badge>
                  </div>
                ))}
            </div>
          </article>
        ))
      ) : (
        <Empty title="Your next plan is ahead">
          Published plans from Coach Jacob appear here.
        </Empty>
      )}
    </Panel>
  );
}
