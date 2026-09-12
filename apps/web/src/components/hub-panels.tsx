"use client";
import {Button,Panel,Empty,Badge} from "@pitch/ui";
import {Plus,Printer} from "lucide-react";
import {dollars,formatTime} from "../lib/api";
import {text,opts,type PanelContext} from "./hub-types";
export function renderHubPanels({coach,minor,aid,data,bookButton,bookings,plans,reports,videos,athleteName,setBooking,setEditor,write,act,createPlan,createReport,feedback,athleteSelect}:PanelContext){
  const lessonsPanel = (
    <Panel
      title={coach ? "Session schedule" : "Your lessons"}
      action={!coach && bookButton}
    >
      {bookings.length ? (
        bookings.map((b) => (
          <article className="lesson-row" key={b.id}>
            <div className="date-tile">
              <strong>{new Date(b.starts_at).getDate()}</strong>
              <span>
                {new Date(b.starts_at).toLocaleDateString("en-US", {
                  month: "short",
                })}
              </span>
            </div>
            <div className="row-grow">
              <h3>
                {coach
                  ? athleteName(b.athlete_id)
                  : "Private training with Jacob"}
              </h3>
              <p>{formatTime(b.starts_at)}</p>
              <p>
                {b.delivery_mode === "online"
                  ? "Online session"
                  : "In-person coaching"}{" "}
                · {b.location_name || "Details coordinated with Coach Jacob"}
              </p>
              {b.address && <p>{b.address}</p>}
              {b.instructions && <p>{b.instructions}</p>}
              {b.meeting_url && (
                <a href={b.meeting_url} target="_blank" rel="noreferrer">
                  Open meeting ↗
                </a>
              )}
              <Badge>{b.status.replaceAll("_", " ")}</Badge>
            </div>
            <div className="row-actions">
              {!coach && !minor && b.status === "confirmed" && (
                <>
                  <button onClick={() => setBooking({ reschedule: b.id })}>
                    Reschedule
                  </button>
                  <button
                    onClick={() =>
                      setEditor({
                        title: "Cancel this lesson?",
                        fields: [],
                        label: `Continue · ${dollars(data.settings.cancellation_fee_cents)} cancellation fee`,
                        submit: () =>
                          write(`/bookings/${b.id}/cancel`, {
                            request_id: crypto.randomUUID(),
                          }),
                      })
                    }
                  >
                    Cancel lesson
                  </button>
                </>
              )}
              {coach && (
                <>
                  <button
                    onClick={() =>
                      setEditor({
                        title: "Session details",
                        fields: [
                          text("location_name", "Location", "text", false),
                          text("address", "Private address", "text", false),
                          text(
                            "meeting_url",
                            "Online meeting URL",
                            "text",
                            false,
                          ),
                          text(
                            "instructions",
                            "Instructions",
                            "textarea",
                            false,
                          ),
                        ],
                        initial: {
                          location_name: b.location_name,
                          address: b.address,
                          meeting_url: b.meeting_url,
                          instructions: b.instructions,
                        },
                        submit: (p) =>
                          write(`/coach/bookings/${b.id}`, p, "PATCH"),
                      })
                    }
                  >
                    Edit details
                  </button>
                  {b.status === "confirmed" &&
                    new Date(b.ends_at) <= new Date() && (
                      <>
                        <button
                          onClick={() =>
                            act(() =>
                              write(`/coach/bookings/${b.id}/action`, {
                                action: "completed",
                              }),
                            )
                          }
                        >
                          Complete
                        </button>
                        <button
                          onClick={() =>
                            act(() =>
                              write(`/coach/bookings/${b.id}/action`, {
                                action: "no_show",
                              }),
                            )
                          }
                        >
                          No-show
                        </button>
                      </>
                    )}
                  <button
                    onClick={() =>
                      setEditor({
                        title: "Cancel and restore credit",
                        fields: [],
                        label: "Restore Credit",
                        submit: () =>
                          write(`/coach/bookings/${b.id}/action`, {
                            action: "restore",
                          }),
                      })
                    }
                  >
                    Restore credit
                  </button>
                </>
              )}
            </div>
          </article>
        ))
      ) : (
        <Empty title="No lessons yet">
          Your next step starts with a coaching credit and an available time.
        </Empty>
      )}
    </Panel>
  );
  const plansPanel = (
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
  const reportsPanel = (
    <Panel
      title="Progress reports"
      action={
        coach ? (
          <Button onClick={createReport}>
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
  const videosPanel = (
    <Panel
      title={coach ? "Video review queue" : "Video analysis"}
      action={
        !coach &&
        !minor && (
          <Button
            disabled={!aid}
            onClick={() =>
              setEditor({
                title: "Send video for analysis",
                fields: [
                  athleteSelect(),
                  text(
                    "customer_notes",
                    "What would you like Jacob to look at?",
                    "textarea",
                    false,
                  ),
                  opts("submission_channel", "Send using", ["email", "sms"]),
                ],
                initial: {
                  athlete_id: aid,
                  submission_channel: "email",
                  customer_notes: "",
                },
                label: "Create Submission",
                submit: (p) => write("/video-submissions", p),
              })
            }
          >
            <Plus size={16} /> Send Video
          </Button>
        )
      }
    >
      {videos.length ? (
        videos.map((v) => {
          const body = `Pitch Lab Video Submission\nReference: ${v.reference_code}\nAthlete: ${athleteName(v.athlete_id)}\n\n${v.customer_notes}\n\nPlease attach your pitching video or a customer-controlled sharing link before sending.`;
          return (
            <article className="video-row" key={v.id}>
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{v.reference_code}</p>
                  <h3>{athleteName(v.athlete_id)}</h3>
                </div>
                <Badge>{v.status.replaceAll("_", " ")}</Badge>
              </div>
              <p>{v.customer_notes}</p>
              {v.received_at && coach && (
                <p className="field-help">
                  Received{" "}
                  {Math.floor(
                    (Date.now() - new Date(v.received_at).getTime()) / 3600000,
                  )}{" "}
                  hours ago · target {data.settings.video_response_target_hours}{" "}
                  hours
                </p>
              )}
              {coach ? (
                <div className="actions">
                  {v.status === "awaiting_video" && (
                    <Button
                      onClick={() =>
                        act(() =>
                          write(
                            `/coach/video-submissions/${v.id}`,
                            { status: "received" },
                            "PATCH",
                          ),
                        )
                      }
                    >
                      Mark Video Received
                    </Button>
                  )}
                  {v.status === "received" && (
                    <Button
                      onClick={() =>
                        act(() =>
                          write(
                            `/coach/video-submissions/${v.id}`,
                            { status: "in_review" },
                            "PATCH",
                          ),
                        )
                      }
                    >
                      Start Review
                    </Button>
                  )}
                  <button
                    className="button outline"
                    onClick={() => feedback(v)}
                  >
                    Write Feedback
                  </button>
                  {v.status !== "closed" && (
                    <button
                      onClick={() =>
                        act(() =>
                          write(
                            `/coach/video-submissions/${v.id}`,
                            { status: "closed" },
                            "PATCH",
                          ),
                        )
                      }
                    >
                      Close
                    </button>
                  )}
                </div>
              ) : (
                v.status === "awaiting_video" && (
                  <>
                    <p>
                      Attach your video manually in your messaging app. For
                      large videos, send an iCloud, Drive, Dropbox, or similar
                      sharing link.
                    </p>
                    <div className="actions">
                      {data.settings.business_email && (
                        <a
                          className="button"
                          href={`mailto:${data.settings.business_email}?subject=${encodeURIComponent(`Pitch Lab Video Submission — ${v.reference_code}`)}&body=${encodeURIComponent(body)}`}
                        >
                          Send by Email ↗
                        </a>
                      )}
                      {data.settings.business_phone && (
                        <a
                          className="button outline"
                          href={`sms:${data.settings.business_phone}?body=${encodeURIComponent(body)}`}
                        >
                          Send by Text ↗
                        </a>
                      )}
                    </div>
                    {!data.settings.business_email &&
                      !data.settings.business_phone && (
                        <p className="notice">
                          Coach contact details are awaiting configuration.
                        </p>
                      )}
                    <p className="field-help">
                      If your device cannot open the composer, copy the
                      reference above into your email or text message.
                    </p>
                  </>
                )
              )}
              {v.video_feedback.map((f, i) => (
                <div className="feedback" key={i}>
                  <h4>Coach feedback</h4>
                  <p>{f.summary}</p>
                  <p>{f.mechanical_notes}</p>
                  <strong>Recommended drills</strong>
                  <p>{f.drill_recommendations}</p>
                </div>
              ))}
            </article>
          );
        })
      ) : (
        <Empty title="A fresh perspective on your mechanics">
          Purchase an analysis credit or use your active Premium membership,
          then send video directly to Jacob.
        </Empty>
      )}
    </Panel>
  );

return {lessonsPanel,plansPanel,reportsPanel,videosPanel};
}
