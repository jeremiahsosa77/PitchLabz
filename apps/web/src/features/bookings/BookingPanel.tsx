"use client";
import { Panel, Empty, Badge } from "@pitch/ui";
import { dollars, formatTime } from "../../lib/api";
import { text } from "../../components/hub-types";
import type { PanelContext } from "../../components/hub-types";
export function BookingPanel({
  coach,
  minor,
  data,
  bookButton,
  bookings,
  athleteName,
  setBooking,
  setEditor,
  write,
  act,
}: Pick<
  PanelContext,
  | "coach"
  | "minor"
  | "data"
  | "bookButton"
  | "bookings"
  | "athleteName"
  | "setBooking"
  | "setEditor"
  | "write"
  | "act"
>) {
  return (
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
}
