"use client";
import {useState,useEffect} from "react";
import {Button,Panel} from "@pitch/ui";
import {api} from "../lib/api";
import {text,opts,type Editor} from "./hub-types";
export function Availability({
  demo,
  actor,
  onEdit,
  write,
}: {
  demo: boolean;
  actor: string;
  onEdit: (e: Editor) => void;
  write: (path: string, p?: unknown, method?: string) => Promise<void>;
}) {
  const [windows, setWindows] = useState<
    {
      id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
      delivery_mode: string;
    }[]
  >([]);
  useEffect(() => {
    if (!demo)
      void api<{ data: typeof windows }>("/coach/availability").then((r) =>
        setWindows(r.data),
      );
  }, [demo, actor]);
  return (
    <Panel
      title="Availability"
      action={
        <div className="actions">
          <Button
            onClick={() =>
              onEdit({
                title: "Add weekly availability",
                fields: [
                  {
                    name: "day_of_week",
                    label: "Day",
                    type: "select",
                    options: [
                      "Sunday",
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                    ].map((label, i) => ({ value: String(i), label })),
                  },
                  text("start_time", "Start time", "time"),
                  text("end_time", "End time", "time"),
                  opts("delivery_mode", "Delivery", [
                    "either",
                    "in_person",
                    "online",
                  ]),
                  { name: "active", label: "Active", type: "checkbox" },
                ],
                initial: { active: true },
                submit: (p) =>
                  write("/coach/availability", {
                    ...p,
                    day_of_week: Number(p.day_of_week),
                  }),
              })
            }
          >
            Add Window
          </Button>
          <button
            onClick={() =>
              onEdit({
                title: "Availability exception",
                fields: [
                  text("date", "Date", "date"),
                  text("start_time", "Start", "time"),
                  text("end_time", "End", "time"),
                  text("reason", "Reason"),
                  {
                    name: "available",
                    label: "Add availability instead of blocking",
                    type: "checkbox",
                  },
                ],
                initial: { available: false },
                submit: (p) => write("/coach/exceptions", p),
              })
            }
          >
            Add Exception
          </button>
        </div>
      }
    >
      <p>
        Recurring times use the business timezone, initially America/Chicago.
        Blocks override recurring windows.
      </p>
      {windows.map((w) => (
        <p key={w.id}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][w.day_of_week]} ·{" "}
          {w.start_time}–{w.end_time} · {w.delivery_mode}
        </p>
      ))}
    </Panel>
  );
}
