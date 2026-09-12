import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "./env";
import { query, rpc } from "./db";
const subjects: Record<string, string> = {
  welcome: "Welcome to Pitch Lab",
  purchase_confirmation: "Your coaching purchase is confirmed",
  premium_started: "Your Premium training credits are ready",
  payment_failed: "Please update your payment method",
  lesson_booked: "Your lesson is booked",
  lesson_reschedule: "Your lesson has been rescheduled",
  lesson_cancel: "Your lesson has been cancelled",
  lesson_reminder: "Your Pitch Lab lesson is coming up",
  video_instructions: "Your video submission is ready",
  video_received: "Jacob received your video",
  feedback_published: "Your Pitch Lab video analysis is ready",
  plan_published: "Your new throwing plan is ready",
  report_published: "Your progress report is ready",
  credit_expiration: "You have training credits approaching expiration",
  booking_action_required: "Your booking change needs attention",
};
export async function deliverNotifications(env: Env, db: SupabaseClient) {
  await rpc(db, "enqueue_reminders");
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    console.info(JSON.stringify({ event: "email_delivery_unconfigured" }));
    return { sent: 0, configured: false };
  }
  const resend = new Resend(env.RESEND_API_KEY);
  const jobs = await rpc<
    {
      id: string;
      customer_id: string;
      template: string;
      dedupe_key: string;
      attempts: number;
    }[]
  >(db, "claim_notifications");
  let sent = 0;
  for (const n of jobs) {
    try {
      const p = await query<{ email: string }>(
        db.from("profiles").select("email").eq("id", n.customer_id).single(),
      );
      const subject = subjects[n.template] || "An update from Pitch Lab";
      const { error } = await resend.emails.send(
        {
          from: env.EMAIL_FROM,
          to: p.email,
          subject,
          text: `${subject}.\n\nSign in to review the details and next steps: ${env.APP_URL}/app\n\nFor video requests, open Video Analysis to send your video directly to Coach Jacob by email or text. Attach the video or a sharing link in your own messaging app.\n\nPitch Lab Athletics`,
        },
        { idempotencyKey: n.dedupe_key },
      );
      if (error) throw new Error("Delivery failed");
      await query(
        db
          .from("notifications")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", n.id),
      );
      sent++;
    } catch {
      await query(
        db
          .from("notifications")
          .update({
            status: "failed",
            available_at: new Date(
              Date.now() + Math.min(3600000, 60000 * 2 ** n.attempts),
            ).toISOString(),
          })
          .eq("id", n.id),
      );
    }
  }
  return { sent, configured: true };
}
