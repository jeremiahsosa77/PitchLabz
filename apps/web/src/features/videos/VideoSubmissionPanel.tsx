"use client";
import { Button, Panel, Empty, Badge } from "@pitch/ui";
import { Plus } from "lucide-react";
import { text, opts } from "../../components/hub-types";
import type { PanelContext } from "../../components/hub-types";
export function VideoSubmissionPanel({
  coach,
  minor,
  aid,
  data,
  videos,
  athleteName,
  setEditor,
  write,
  act,
  feedback,
  athleteSelect,
}: Pick<
  PanelContext,
  | "coach"
  | "minor"
  | "aid"
  | "data"
  | "videos"
  | "athleteName"
  | "setEditor"
  | "write"
  | "act"
  | "feedback"
  | "athleteSelect"
>) {
  return (
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
                      {data.settings.business_email && (
                        <>
                          Email: {data.settings.business_email}
                          <br />
                        </>
                      )}
                      {data.settings.business_phone && (
                        <>Text: {data.settings.business_phone}</>
                      )}
                    </p>
                    <details>
                      <summary>Copy submission instructions</summary>
                      <p style={{ whiteSpace: "pre-wrap" }}>{body}</p>
                    </details>
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
}
