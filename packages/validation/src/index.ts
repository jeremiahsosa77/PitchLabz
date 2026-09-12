import { z } from "zod";
export const id = z.string().uuid();
export const date = z.string().date();
const text = z.string().trim().min(1).max(200);
const prose = z.string().trim().max(10000);
export const athleteSchema = z
  .object({
    first_name: text,
    last_name: text,
    date_of_birth: date,
    school: z.string().max(200).nullable().optional(),
    graduation_year: z.number().int().min(2000).max(2100).nullable().optional(),
    competitive_level: z.enum([
      "youth",
      "middle_school",
      "high_school",
      "college",
      "adult",
    ]),
    throws: z.enum(["R", "L", "S"]),
    goals: prose.default(""),
  })
  .strict()
  .refine(
    (v) => v.date_of_birth <= new Date().toISOString().slice(0, 10),
    "Birth date cannot be in the future",
  );
export const onboardingSchema = z
  .object({
    role: z.enum(["parent", "athlete"]),
    first_name: text,
    last_name: text,
    date_of_birth: date,
  })
  .strict();
export const checkoutSchema = z
  .object({ athlete_id: id, product_id: id, request_id: id })
  .strict();
export const bookingSchema = z
  .object({
    athlete_id: id,
    coach_id: id,
    starts_at: z.string().datetime({ offset: true }),
    delivery_mode: z.enum(["online", "in_person"]),
    kind: z.enum(["lesson", "recorded_lesson"]).default("lesson"),
  })
  .strict();
export const rescheduleSchema = z
  .object({ starts_at: z.string().datetime({ offset: true }), request_id: id })
  .strict();
export const cancelSchema = z.object({ request_id: id }).strict();
export const videoSchema = z
  .object({
    athlete_id: id,
    customer_notes: prose.default(""),
    submission_channel: z.enum(["sms", "email"]),
  })
  .strict();
export const feedbackSchema = z
  .object({
    summary: prose.min(1),
    mechanical_notes: prose,
    drill_recommendations: prose,
    publish: z.boolean(),
  })
  .strict();
export const planSchema = z
  .object({
    athlete_id: id,
    title: text,
    description: prose,
    start_date: date,
    end_date: date,
    status: z.enum(["draft", "published", "archived"]),
    days: z
      .array(
        z
          .object({
            date,
            title: text,
            instructions: prose,
            intensity: z.enum(["rest", "low", "moderate", "high"]),
          })
          .strict(),
      )
      .max(90),
  })
  .strict()
  .refine(
    (v) =>
      v.end_date >= v.start_date &&
      v.days.every((d) => d.date >= v.start_date && d.date <= v.end_date),
    "Plan days must be within the plan dates",
  );
export const reportSchema = z
  .object({
    athlete_id: id,
    report_period: date,
    summary: prose.min(1),
    wins: prose,
    areas_to_improve: prose,
    next_focus: prose,
    coach_notes: prose,
    publish: z.boolean(),
  })
  .strict();
export const noteSchema = z
  .object({
    athlete_id: id,
    content: prose.min(1),
    visibility: z.enum(["private", "customer_visible"]).default("private"),
  })
  .strict();
export const availabilitySchema = z
  .object({
    day_of_week: z.number().int().min(0).max(6),
    start_time: z.string().regex(/^\d{2}:\d{2}$/),
    end_time: z.string().regex(/^\d{2}:\d{2}$/),
    delivery_mode: z.enum(["online", "in_person", "either"]),
    active: z.boolean(),
  })
  .strict()
  .refine((v) => v.end_time > v.start_time, "End must follow start");
export const exceptionSchema = z
  .object({
    date,
    start_time: z.string().regex(/^\d{2}:\d{2}$/),
    end_time: z.string().regex(/^\d{2}:\d{2}$/),
    available: z.boolean(),
    reason: z.string().max(200),
  })
  .strict()
  .refine((v) => v.end_time > v.start_time, "End must follow start");
export const settingsSchema = z
  .object({
    business_name: text,
    business_email: z.union([z.string().email(), z.literal("")]),
    business_phone: z.string().regex(/^$|^\+[1-9]\d{7,14}$/),
    business_timezone: z.string().refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }),
    booking_window_days: z.number().int().min(1).max(180),
    minimum_booking_notice_hours: z.number().int().min(1).max(168),
    free_reschedule_notice_hours: z.number().int().min(0).max(168),
    late_reschedule_fee_cents: z.number().int().min(0).max(10000),
    cancellation_fee_cents: z.number().int().min(0).max(10000),
    premium_capacity: z.number().int().min(0).max(1000),
    credit_rollover_months: z.number().int().min(0).max(12),
    video_response_target_hours: z.number().int().min(1).max(168),
    payment_grace_days: z.number().int().min(0).max(30),
    retention_discount_enabled: z.boolean(),
  })
  .strict();
export const productUpdateSchema = z
  .object({
    name: text,
    description: prose,
    price_cents: z.number().int().min(50).max(1000000),
    active: z.boolean(),
    benefits: z.array(text).max(20),
    capacity: z.number().int().nonnegative().nullable(),
  })
  .strict();
export const bookingDetailsSchema = z
  .object({
    location_name: z.string().max(200).nullable(),
    address: z.string().max(500).nullable(),
    instructions: prose.nullable(),
    meeting_url: z
      .union([
        z
          .string()
          .url()
          .refine((v) => v.startsWith("https://")),
        z.literal(""),
      ])
      .nullable(),
  })
  .strict();
