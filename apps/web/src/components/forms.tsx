"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@pitch/ui";
import { X } from "lucide-react";
import type { Slot } from "@pitch/contracts";
import { api, formatTime } from "../lib/api";
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog ref={ref} className="modal" onCancel={close}>
      <div className="panel-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={close}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export interface Field {
  name: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "date"
    | "number"
    | "select"
    | "checkbox"
    | "time"
    | "email";
  options?: { value: string; label: string }[];
  required?: boolean;
}
export function DataForm({
  fields,
  initial = {},
  submit,
  label = "Save",
  children,
}: {
  fields: Field[];
  initial?: Record<string, unknown>;
  submit: (data: Record<string, unknown>) => Promise<void>;
  label?: string;
  children?: ReactNode;
}) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<Record<string, unknown>>({
    defaultValues: Object.fromEntries(
      fields.map((f) => [f.name, initial[f.name]]),
    ),
  });
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={handleSubmit(async (data) => {
        setError("");
        try {
          await submit(data);
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : "Unable to save. Please try again.",
          );
        }
      })}
    >
      {fields.map((f) => (
        <label
          key={f.name}
          className={f.type === "checkbox" ? "check-field" : ""}
        >
          {f.type !== "checkbox" && f.label}
          {f.type === "textarea" ? (
            <textarea
              rows={4}
              {...register(f.name, {
                required: f.required ? "This field is required." : false,
              })}
            />
          ) : f.type === "select" ? (
            <select
              aria-label={f.label}
              {...register(f.name, {
                required: f.required ? "Select an option." : false,
              })}
            >
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={f.type || "text"}
              {...register(f.name, {
                required: f.required ? "This field is required." : false,
                ...(f.type === "number" ? { valueAsNumber: true } : {}),
              })}
            />
          )}{" "}
          {f.type === "checkbox" && f.label}
          {errors[f.name] && (
            <span className="field-error">
              {String(errors[f.name]?.message)}
            </span>
          )}
        </label>
      ))}
      {children}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <Button disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : label}
      </Button>
    </form>
  );
}
export function SlotPicker({
  athlete_id,
  reschedule,
  close,
  saved,
  demo = false,
}: {
  athlete_id: string;
  reschedule?: string;
  close: () => void;
  saved: () => void;
  demo?: boolean;
}) {
  const [date, setDate] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  );
  const [mode, setMode] = useState("in_person");
  const [kind, setKind] = useState("lesson");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  async function find() {
    setLoading(true);
    setError("");
    setSelected("");
    try {
      if (demo)
        throw new Error(
          "Scheduling is disabled in the development preview. Sign in to use a configured account.",
        );
      setSlots(
        (
          await api<{ data: Slot[] }>(
            `/availability?date=${date}&delivery_mode=${mode}`,
          )
        ).data,
      );
      setSearched(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function book() {
    const slot = slots.find((s) => s.starts_at === selected);
    if (!slot) return;
    setLoading(true);
    try {
      const result = await api<{ url?: string }>(
        reschedule ? `/bookings/${reschedule}/reschedule` : "/bookings",
        reschedule
          ? { starts_at: slot.starts_at, request_id: crypto.randomUUID() }
          : {
              athlete_id,
              coach_id: slot.coach_id,
              starts_at: slot.starts_at,
              delivery_mode: mode,
              kind,
            },
      );
      if (result.url) window.location.assign(result.url);
      else {
        saved();
        close();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Modal
      title={reschedule ? "Reschedule lesson" : "Book a lesson"}
      close={close}
    >
      <p>
        Select an available time. Times are displayed in Central Time. A credit
        must remain valid through the selected lesson.
      </p>
      <label>
        Date
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setSearched(false);
          }}
        />
      </label>
      <label>
        Delivery
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value);
            setSearched(false);
          }}
        >
          <option value="in_person">In person</option>
          <option value="online">Online</option>
        </select>
      </label>
      {!reschedule && (
        <label>
          Session type
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="lesson">Private training</option>
            <option value="recorded_lesson">Recorded session</option>
          </select>
        </label>
      )}
      <Button disabled={loading} onClick={find}>
        {loading ? "Checking…" : "Find Available Times"}
      </Button>
      {searched && (
        <div className="slot-list">
          {slots.length ? (
            slots.map((s) => (
              <button
                className={`slot ${selected === s.starts_at ? "selected" : ""}`}
                key={s.coach_id + s.starts_at}
                onClick={() => setSelected(s.starts_at)}
              >
                {formatTime(s.starts_at)}
              </button>
            ))
          ) : (
            <p>No times available. Try another date or delivery option.</p>
          )}
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {reschedule && (
        <p className="notice">
          Within 48 hours of your original lesson, the configured late fee is
          collected at checkout. Your original lesson stays booked until payment
          and the change succeed.
        </p>
      )}
      {selected && (
        <Button disabled={loading} onClick={book}>
          {reschedule ? "Continue with Change" : "Confirm Lesson"}
        </Button>
      )}
    </Modal>
  );
}
