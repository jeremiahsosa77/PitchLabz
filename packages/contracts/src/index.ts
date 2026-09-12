export type Role = "parent" | "athlete" | "coach" | "admin";
export interface Profile {
  id: string;
  role: Role;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
}
export interface Athlete {
  id: string;
  owner_parent_id: string | null;
  athlete_user_id: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  school: string | null;
  graduation_year: number | null;
  competitive_level: string;
  throws: "R" | "L" | "S";
  goals: string;
  active: boolean;
}
export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  product_type: "lesson" | "recorded_lesson" | "premium" | "video";
  price_cents: number;
  billing_interval: "month" | null;
  benefits: string[];
  active: boolean;
  display_order: number;
  capacity: number | null;
  full?: boolean;
}
export interface Credit {
  id: string;
  athlete_id: string;
  product_id: string;
  remaining: number;
  quantity: number;
  issued_at: string;
  expires_at: string | null;
  kind: "lesson" | "recorded_lesson" | "video";
}
export interface Booking {
  id: string;
  athlete_id: string;
  coach_id: string;
  starts_at: string;
  ends_at: string;
  delivery_mode: "online" | "in_person";
  status: "confirmed" | "completed" | "cancelled" | "no_show";
  location_name: string | null;
  address: string | null;
  instructions: string | null;
  meeting_url: string | null;
}
export interface PlanDay {
  date: string;
  title: string;
  instructions: string;
  intensity: string;
}
export interface Plan {
  id: string;
  athlete_id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  status: "draft" | "published" | "archived";
  throwing_plan_days: PlanDay[];
}
export interface Report {
  id: string;
  athlete_id: string;
  report_period: string;
  summary: string;
  wins: string;
  areas_to_improve: string;
  next_focus: string;
  coach_notes: string;
  published_at: string | null;
}
export interface Video {
  id: string;
  athlete_id: string;
  reference_code: string;
  customer_notes: string;
  submission_channel: "email" | "sms";
  status: "awaiting_video" | "received" | "in_review" | "completed" | "closed";
  created_at: string;
  received_at: string | null;
  video_feedback: Feedback[];
}
export interface Feedback {
  summary: string;
  mechanical_notes: string;
  drill_recommendations: string;
  published_at: string | null;
}
export interface Subscription {
  id: string;
  athlete_id: string;
  status: string;
  current_period_end: string;
  payment_failed_at: string | null;
  cancel_at_period_end: boolean;
}
export interface Order {
  id: string;
  athlete_id: string;
  total_cents: number;
  status: string;
  created_at: string;
}
export interface Note {
  id: string;
  athlete_id: string;
  content: string;
  visibility: "private" | "customer_visible";
  created_at: string;
}
export interface Settings {
  business_name: string;
  business_email: string;
  business_phone: string;
  business_timezone: string;
  booking_window_days: number;
  minimum_booking_notice_hours: number;
  free_reschedule_notice_hours: number;
  late_reschedule_fee_cents: number;
  cancellation_fee_cents: number;
  premium_capacity: number;
  credit_rollover_months: number;
  video_response_target_hours: number;
  payment_grace_days: number;
  retention_discount_enabled: boolean;
}
export interface HubData {
  profile: Profile;
  athletes: Athlete[];
  bookings: Booking[];
  credits: Credit[];
  plans: Plan[];
  reports: Report[];
  videos: Video[];
  subscriptions: Subscription[];
  orders: Order[];
  notes: Note[];
  products: Product[];
  settings: Settings;
  customers?: Profile[];
  activity?: { action: string; created_at: string }[];
}
export interface Slot {
  coach_id: string;
  starts_at: string;
  ends_at: string;
  delivery_mode: "online" | "in_person";
}
export interface ApiError {
  error: { code: string; message: string };
}
