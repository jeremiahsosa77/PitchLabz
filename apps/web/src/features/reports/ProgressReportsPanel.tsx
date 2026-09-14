"use client";
import { Button, Panel, Empty, Badge } from "@pitch/ui";
import { Plus, Printer } from "lucide-react";
import type { PanelContext } from "../../components/hub-types";
export function ProgressReportsPanel({
  coach,
  reports,
  athleteName,
  createReport,
}: Pick<PanelContext, "coach" | "reports" | "athleteName" | "createReport">) {
  return (
    <Panel
      title="Progress reports"
      action={
        coach ? (
          <Button onClick={() => createReport()}>
            <Plus size={16} /> Create Report
          </Button>
        ) : (
          <button onClick={() => window.print()} className="text-link">
            <Printer size={16} /> Print / Save PDF
          </button>
        )
      }
    >
      {reports.length ? (
        reports.map((r) => (
          <article className="report" key={r.id}>
            {coach && (
              <Button onClick={() => createReport(r)}>Edit Report</Button>
            )}
            <div className="panel-heading">
              <h3>
                {new Date(r.report_period + "T12:00:00Z").toLocaleDateString(
                  "en-US",
                  { month: "long", year: "numeric" },
                )}{" "}
                · {athleteName(r.athlete_id)}
              </h3>
              <Badge>{r.published_at ? "Published" : "Draft"}</Badge>
            </div>
            {[
              ["This month", r.summary],
              ["What’s improving", r.wins],
              ["Areas to improve", r.areas_to_improve],
              ["Next focus", r.next_focus],
              ["Coach feedback", r.coach_notes],
            ].map(([title, body]) => (
              <section key={title}>
                <h4>{title}</h4>
                <p>{body}</p>
              </section>
            ))}
          </article>
        ))
      ) : (
        <Empty title="Progress takes shape here">
          Your coach’s published reports will appear here.
        </Empty>
      )}
    </Panel>
  );
}
