import type { HubData } from "@pitch/contracts";
import { catalog, defaults } from "@pitch/config";
const parent = "20000000-0000-4000-8000-000000000001",
  athlete = "30000000-0000-4000-8000-000000000001",
  coach = "20000000-0000-4000-8000-000000000004";
export function demoData(isCoach = false): HubData {
  const today = new Date().toISOString().slice(0, 10);
  const future = (days: number) =>
    new Date(Date.now() + days * 86400000).toISOString();
  return {
    profile: {
      id: isCoach ? coach : parent,
      role: isCoach ? "admin" : "parent",
      first_name: isCoach ? "Jacob" : "Sarah",
      last_name: isCoach ? "Sosa" : "Johnson",
      email: "demo@example.test",
      phone: null,
      date_of_birth: null,
    },
    athletes: [
      {
        id: athlete,
        owner_parent_id: parent,
        athlete_user_id: null,
        first_name: "Mason",
        last_name: "Johnson",
        date_of_birth: "2010-05-10",
        school: "Example High School",
        graduation_year: 2028,
        competitive_level: "high_school",
        throws: "R",
        goals: "Build a consistent delivery and command the zone.",
        active: true,
      },
      {
        id: "30000000-0000-4000-8000-000000000002",
        owner_parent_id: parent,
        athlete_user_id: null,
        first_name: "Luke",
        last_name: "Johnson",
        date_of_birth: "2014-03-22",
        school: null,
        graduation_year: 2032,
        competitive_level: "youth",
        throws: "L",
        goals: "Build confidence on the mound.",
        active: true,
      },
    ],
    bookings: [
      {
        id: "40000000-0000-4000-8000-000000000001",
        athlete_id: athlete,
        coach_id: coach,
        starts_at: future(3),
        ends_at: new Date(Date.now() + 3 * 86400000 + 3600000).toISOString(),
        delivery_mode: "in_person",
        status: "confirmed",
        location_name: null,
        address: null,
        instructions: null,
        meeting_url: null,
      },
    ],
    credits: [
      {
        id: "50000000-0000-4000-8000-000000000001",
        athlete_id: athlete,
        product_id: catalog[2].id,
        remaining: 3,
        quantity: 4,
        issued_at: future(-7),
        expires_at: future(48),
        kind: "lesson",
      },
    ],
    plans: [
      {
        id: "60000000-0000-4000-8000-000000000001",
        athlete_id: athlete,
        title: "Build a consistent foundation",
        description:
          "Example development plan — demonstration only, not an individualized training prescription.",
        start_date: today,
        end_date: future(6).slice(0, 10),
        status: "published",
        throwing_plan_days: [
          "Recovery + mobility",
          "Command focus",
          "Light catch",
          "Bullpen session",
          "Recovery",
          "Game preparation",
          "Rest",
        ].map((title, i) => ({
          date: future(i).slice(0, 10),
          title,
          instructions:
            "Review your assigned work with Coach Jacob before training.",
          intensity: i === 3 ? "high" : i === 6 ? "rest" : "low",
        })),
      },
    ],
    reports: [
      {
        id: "70000000-0000-4000-8000-000000000001",
        athlete_id: athlete,
        report_period: today,
        summary: "Example report: a month of purposeful development.",
        wins: "More consistent preparation and a repeatable practice routine.",
        areas_to_improve: "Continue building command through focused work.",
        next_focus: "Take the same preparation into every bullpen.",
        coach_notes:
          "Demonstration content only. Real reports are written by your coach.",
        published_at: future(-2),
      },
    ],
    videos: [
      {
        id: "80000000-0000-4000-8000-000000000001",
        athlete_id: athlete,
        reference_code: "PLA-V-DEMO",
        customer_notes: "Example request: review my delivery from the stretch.",
        submission_channel: "email",
        status: "in_review",
        created_at: future(-1),
        received_at: future(-0.6),
        video_feedback: [],
      },
    ],
    subscriptions: [
      {
        id: "90000000-0000-4000-8000-000000000001",
        athlete_id: athlete,
        status: "active",
        current_period_end: future(23),
        payment_failed_at: null,
        cancel_at_period_end: false,
      },
    ],
    orders: [],
    notes: [],
    products: catalog,
    settings: defaults,
    customers: [],
    activity: [],
  };
}
