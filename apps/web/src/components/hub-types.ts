import type { ReactNode } from "react";
import type { HubData, Booking, Plan, Report, Video } from "@pitch/contracts";
import type { Field } from "./forms";
export type Editor = {
  title: string;
  fields: Field[];
  initial?: Record<string, unknown>;
  submit: (p: Record<string, unknown>) => Promise<void>;
  label?: string;
};
export const text = (
  name: string,
  label: string,
  type: Field["type"] = "text",
  required = true,
): Field => ({ name, label, type, required });
export const opts = (name: string, label: string, values: string[]): Field => ({
  name,
  label,
  type: "select",
  options: values.map((value) => ({
    value,
    label: value.replaceAll("_", " "),
  })),
});
export interface PanelContext {
  coach: boolean;
  minor: boolean;
  aid: string;
  data: HubData;
  bookButton: ReactNode;
  bookings: Booking[];
  plans: Plan[];
  reports: Report[];
  videos: Video[];
  athleteName: (id: string) => string;
  setBooking: (b: { reschedule?: string }) => void;
  setEditor: (e: Editor) => void;
  write: (path: string, p?: unknown, method?: string) => Promise<void>;
  act: (fn: () => Promise<void>) => Promise<void>;
  createPlan: (plan?: Plan) => void;
  createReport: (report?: Report) => void;
  feedback: (video: Video) => void;
  athleteSelect: () => Field;
}
