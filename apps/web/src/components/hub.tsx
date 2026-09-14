"use client";
import { CoachPriorities } from "../features/coach/CoachPriorities";
import { RevenuePanel } from "./revenue";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Home,
  LogOut,
  Menu,
  Plus,
  Settings,
  Users,
  Video as VideoIcon,
  X,
  Target,
} from "lucide-react";
import { Button, Panel, Empty, Badge } from "@pitch/ui";
import type {
  Athlete,
  HubData,
  Plan,
  Product,
  Report,
  Video,
} from "@pitch/contracts";
import { api, ApiFailure, auth, dollars, formatTime } from "../lib/api";
import { demoData } from "../lib/demo";
import { Brand } from "./brand";
import { DataForm, Modal, SlotPicker, type Field } from "./forms";
import { text, opts, type Editor } from "./hub-types";
import { renderHubPanels } from "./hub-panels";
import { Availability } from "./availability";
import { athleteFields } from "../features/athletes/athlete-fields";
export function Hub({
  coach = false,
  demo = false,
  segments = [],
}: {
  coach?: boolean;
  demo?: boolean;
  segments?: string[];
}) {
  const router = useRouter();
  const [data, setData] = useState<HubData | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState("");
  const [mobile, setMobile] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [booking, setBooking] = useState<{ reschedule?: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const section = segments[0] || "dashboard";
  const prefix = demo
    ? coach
      ? "/preview/coach"
      : "/preview"
    : coach
      ? "/coach"
      : "/app";
  const refresh = () => setRevision((n) => n + 1);
  useEffect(() => {
    let active = true;
    setError("");
    if (demo) {
      setData(demoData(coach));
      return;
    }
    void api<{ data: HubData }>("/hub")
      .then(async (result) => {
        if (coach && !["coach", "admin"].includes(result.data.profile.role))
          throw new ApiFailure(
            "FORBIDDEN",
            "This workspace is for coaching staff.",
          );
        if (coach) {
          const [customers, activity] = await Promise.all([
            api<{ data: HubData["customers"] }>("/coach/customers"),
            api<{ data: HubData["activity"] }>("/coach/activity"),
          ]);
          result.data.customers = customers.data;
          result.data.activity = activity.data;
        }
        if (active) setData(result.data);
      })
      .catch((e) => {
        if (!active) return;
        if (e instanceof ApiFailure && e.code === "UNAUTHENTICATED") {
          router.replace("/login");
          return;
        }
        setData(null);
        setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [coach, demo, revision, router]);
  useEffect(() => {
    if (data && !data.athletes.some((a) => a.id === selected))
      setSelected(data.athletes[0]?.id || "");
  }, [data, selected]);
  const write = async (path: string, p?: unknown, method?: string) => {
    if (demo)
      throw new Error(
        "This is a read-only development preview. Sign in to use your configured account.",
      );
    const result = await api<{ url?: string }>(path, p, method);
    if (result.url) {
      window.location.assign(result.url);
      return;
    }
    setMessage("Saved successfully.");
    setEditor(null);
    refresh();
  };
  const act = async (fn: () => Promise<void>) => {
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const nav = coach
    ? ([
        ["dashboard", "Today", Home],
        ["calendar", "Calendar", CalendarDays],
        ["customers", "Customers", Users],
        ["athletes", "Athletes", Users],
        ["video", "Video Queue", VideoIcon],
        ["plans", "Throwing Plans", ClipboardList],
        ["progress", "Progress Reports", Activity],
        ["products", "Products", Target],
        ["revenue", "Revenue", CreditCard],
        ["settings", "Settings", Settings],
      ] as const)
    : ([
        ["dashboard", "Dashboard", Home],
        ["athletes", "Athletes", Users],
        ["lessons", "Lessons", CalendarDays],
        ["video", "Video Analysis", VideoIcon],
        ["plans", "Throwing Plans", ClipboardList],
        ["progress", "Progress", Activity],
        ["billing", "Billing", CreditCard],
        ["account", "Account", Settings],
      ] as const);
  if (!data)
    return (
      <main id="main" className="loading-page">
        <Brand />
        <div className="panel">
          <p className="eyebrow">PITCH LAB ATHLETICS</p>
          <h1>
            {error
              ? "Your workspace is unavailable."
              : "Opening your workspace…"}
          </h1>
          {error ? (
            <>
              <p className="error" role="alert">
                {error}
              </p>
              <Button onClick={refresh}>Try Again</Button>
              <Link href="/login"> Sign in</Link>
              <p>
                <Link href="/preview">Explore development preview ↗</Link>
              </p>
            </>
          ) : (
            <div className="skeleton" />
          )}
        </div>
      </main>
    );
  const minor =
    data.profile.role === "athlete" &&
    data.athletes.some(
      (a) =>
        a.athlete_user_id === data.profile.id && a.owner_parent_id !== null,
    );
  if (
    (minor &&
      [
        "billing",
        "athletes",
        "products",
        "settings",
        "revenue",
        "customers",
      ].includes(section)) ||
    (coach &&
      data.profile.role !== "admin" &&
      ["products", "revenue", "settings"].includes(section))
  )
    return (
      <main id="main" className="loading-page">
        <h1>This page is unavailable for your account.</h1>
        <p>Your coaching records are available in your workspace.</p>
        <Link href={prefix}>Return to dashboard</Link>
      </main>
    );
  if (
    segments[1] &&
    (!coach ||
      section !== "athletes" ||
      !data.athletes.some((a) => a.id === segments[1]))
  )
    return (
      <main id="main" className="loading-page">
        <h1>Athlete workspace unavailable</h1>
        <Link href={prefix}>Return to dashboard</Link>
      </main>
    );
  const aid = coach && segments[1] ? segments[1] : selected;
  const athlete = data.athletes.find((a) => a.id === aid);
  const scoped = <T extends { athlete_id: string }>(rows: T[]) =>
    coach && !segments[1] ? rows : rows.filter((r) => r.athlete_id === aid);
  const bookings = scoped(data.bookings).sort((a, b) =>
    a.starts_at.localeCompare(b.starts_at),
  );
  const upcoming = bookings.filter(
    (b) => b.status === "confirmed" && new Date(b.starts_at) > new Date(),
  );
  const credits = scoped(data.credits).filter(
    (c) => !c.expires_at || new Date(c.expires_at) > new Date(),
  );
  const plans = [...scoped(data.plans)].sort((a, b) =>
    b.start_date.localeCompare(a.start_date),
  );
  const reports = [...scoped(data.reports)].sort((a, b) =>
    b.report_period.localeCompare(a.report_period),
  );
  const videos = scoped(data.videos);
  const subs = scoped(data.subscriptions);
  const available = credits
    .filter((c) => c.kind !== "video")
    .reduce((n, c) => n + c.remaining, 0);
  const athleteName = (id: string) => {
    const a = data.athletes.find((a) => a.id === id);
    return a ? `${a.first_name} ${a.last_name}` : "Athlete";
  };
  function addAthlete(a?: Athlete) {
    setEditor({
      title: a ? "Edit athlete" : "Add your athlete",
      fields: athleteFields,
      initial: a ? { ...a } : { competitive_level: "youth", throws: "R" },
      submit: (p) =>
        write(
          a ? `/athletes/${a.id}` : "/athletes",
          {
            ...p,
            graduation_year: Number.isFinite(p.graduation_year)
              ? p.graduation_year
              : null,
            school: p.school || null,
          },
          a ? "PATCH" : "POST",
        ),
    });
  }
  function createPlan(plan?: Plan) {
    const initial = {
      athlete_id: aid,
      title: "",
      description: "",
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10),
      status: "draft",
      ...(plan
        ? {
            athlete_id: plan.athlete_id,
            title: plan.title,
            description: plan.description,
            start_date: plan.start_date,
            end_date: plan.end_date,
            status: plan.status,
          }
        : {}),
      ...Object.fromEntries(
        (plan?.throwing_plan_days || []).flatMap((d, i) => [
          [`day${i}`, d.title],
          [`instructions${i}`, d.instructions],
          [`intensity${i}`, d.intensity],
        ]),
      ),
    };
    setEditor({
      title: plan ? "Edit throwing plan" : "Create weekly throwing plan",
      initial,
      fields: [
        athleteSelect(),
        text("title", "Plan title"),
        text("description", "Overview", "textarea"),
        text("start_date", "First day", "date"),
        text("end_date", "Last day", "date"),
        opts("status", "Status", ["draft", "published", "archived"]),
        ...Array.from({ length: 7 }, (_, i) => [
          text(`day${i}`, `Day ${i + 1} focus`, "text", false),
          text(
            `instructions${i}`,
            `Day ${i + 1} instructions`,
            "textarea",
            false,
          ),
          opts(`intensity${i}`, `Day ${i + 1} intensity`, [
            "rest",
            "low",
            "moderate",
            "high",
          ]),
        ]).flat(),
      ],
      submit: (p) => {
        const days = Array.from({ length: 7 }, (_, i) => ({
          date: new Date(
            new Date(String(p.start_date)).getTime() + i * 86400000,
          )
            .toISOString()
            .slice(0, 10),
          title: p[`day${i}`],
          instructions: p[`instructions${i}`] || "",
          intensity: p[`intensity${i}`],
        })).filter((d) => d.title);
        return write(
          plan ? `/coach/throwing-plans/${plan.id}` : "/coach/throwing-plans",
          {
            athlete_id: p.athlete_id,
            title: p.title,
            description: p.description,
            start_date: p.start_date,
            end_date: p.end_date,
            status: p.status,
            days,
          },
          plan ? "PATCH" : "POST",
        );
      },
    });
  }
  function athleteSelect(): Field {
    return {
      name: "athlete_id",
      label: "Athlete",
      type: "select",
      options: data!.athletes.map((a) => ({
        value: a.id,
        label: `${a.first_name} ${a.last_name}`,
      })),
    };
  }
  function createReport(report?: Report) {
    setEditor({
      title: report ? "Edit progress report" : "Create progress report",
      fields: [
        athleteSelect(),
        text("report_period", "Report period", "date"),
        text("summary", "This month", "textarea"),
        text("wins", "What’s improving", "textarea"),
        text("areas_to_improve", "Areas to improve", "textarea"),
        text("next_focus", "Next focus", "textarea"),
        text("coach_notes", "Customer-visible coach feedback", "textarea"),
        {
          name: "publish",
          label: "Publish to athlete and guardian",
          type: "checkbox",
        },
      ],
      initial: {
        athlete_id: aid,
        report_period: new Date().toISOString().slice(0, 10),
        ...(report ? { ...report, publish: !!report.published_at } : {}),
      },
      submit: (p) =>
        write(
          report
            ? `/coach/progress-reports/${report.id}`
            : "/coach/progress-reports",
          { ...p, publish: !!p.publish },
          report ? "PATCH" : "POST",
        ),
    });
  }
  function feedback(video: Video) {
    setEditor({
      title: `Feedback · ${video.reference_code}`,
      fields: [
        text("summary", "Summary", "textarea"),
        text("mechanical_notes", "Mechanical notes", "textarea"),
        text("drill_recommendations", "Corrective drills", "textarea"),
        {
          name: "publish",
          label: "Publish feedback and complete review",
          type: "checkbox",
        },
      ],
      initial: video.video_feedback[0] ? { ...video.video_feedback[0] } : {},
      submit: (p) =>
        write(`/coach/video-submissions/${video.id}/feedback`, {
          summary: p.summary,
          mechanical_notes: p.mechanical_notes,
          drill_recommendations: p.drill_recommendations,
          publish: !!p.publish,
        }),
    });
  }
  function buy(p: Product) {
    if (!aid) {
      setMessage("Add or select an athlete before choosing a program.");
      return;
    }
    setEditor({
      title: p.full ? "Join the Premium waitlist" : `Choose ${p.name}`,
      fields: [athleteSelect()],
      initial: { athlete_id: aid },
      label: p.full
        ? "Join Waitlist"
        : `Continue to Stripe · ${dollars(p.price_cents)}${p.billing_interval ? "/month" : ""}`,
      submit: (d) =>
        write(p.full ? "/waitlist" : "/checkout/session", {
          athlete_id: d.athlete_id,
          product_id: p.id,
          ...(!p.full ? { request_id: crypto.randomUUID() } : {}),
        }),
    });
  }
  const bookButton = (
    <Button disabled={!aid || minor} onClick={() => setBooking({})}>
      <Plus size={16} /> Book Lesson
    </Button>
  );
  const { lessonsPanel, plansPanel, reportsPanel, videosPanel } =
    renderHubPanels({
      coach,
      minor,
      aid,
      data,
      bookButton,
      bookings,
      plans,
      reports,
      videos,
      athleteName,
      setBooking,
      setEditor,
      write,
      act,
      createPlan,
      createReport,
      feedback,
      athleteSelect,
    });
  return (
    <div className="hub-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <Brand />
        <div className="workspace-label">
          {coach ? "COACH WORKSPACE" : "ATHLETE HUB"}
        </div>
        <nav aria-label="Workspace navigation">
          {nav
            .filter(
              ([key]) =>
                (!minor || !["billing", "athletes"].includes(key)) &&
                (!coach ||
                  data.profile.role === "admin" ||
                  !["products", "revenue", "settings"].includes(key)),
            )
            .map(([key, label, Icon]) => (
              <Link
                key={key}
                className={section === key ? "active" : ""}
                href={`${prefix}${key === "dashboard" ? "" : `/${key}`}`}
                onClick={() => setMobile(false)}
              >
                <Icon size={19} />
                {label}
                {key === "video" && videos.length > 0 && (
                  <span className="nav-count">
                    {
                      videos.filter(
                        (v) =>
                          v.status !== "completed" && v.status !== "closed",
                      ).length
                    }
                  </span>
                )}
              </Link>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="coach-mini">
            <span className="avatar">
              {data.profile.first_name[0]}
              {data.profile.last_name[0]}
            </span>
            <div>
              <strong>
                {data.profile.first_name} {data.profile.last_name}
              </strong>
              <small>{demo ? "Development preview" : data.profile.role}</small>
            </div>
          </div>
          <button
            onClick={() =>
              act(async () => {
                if (!demo) await auth().auth.signOut();
                router.push("/");
              })
            }
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <div className="hub-body">
        <header className="hub-top">
          <button
            className="menu-toggle"
            aria-label="Toggle workspace navigation"
            onClick={() => setMobile(!mobile)}
          >
            {mobile ? <X /> : <Menu />}
          </button>
          <p>
            Pitch Lab <span>/ {coach ? "Coach Workspace" : "Athlete Hub"}</span>
          </p>
          <Link className="text-link" href="/">
            Visit website <ArrowUpRight size={15} />
          </Link>
        </header>
        {demo && (
          <div className="demo-banner">
            DEVELOPMENT PREVIEW · Fictional athlete data · Changes and payments
            disabled{" "}
            <Link href={coach ? "/preview" : "/preview/coach"}>
              {coach ? "View Athlete Hub" : "View Coach Workspace"} ↗
            </Link>
          </div>
        )}
        <main id="main" className="hub-main">
          <div className="hub-heading">
            <div>
              <p className="eyebrow">
                {coach
                  ? "DEVELOPMENT STARTS WITH A PLAN"
                  : "YOUR DEVELOPMENT, IN FOCUS"}
              </p>
              <h1>
                {section === "dashboard"
                  ? coach
                    ? "Let’s get to work, Jacob."
                    : `Welcome back, ${data.profile.first_name}.`
                  : nav.find(([key]) => key === section)?.[1] ||
                    "Athlete workspace"}
              </h1>
              <p>
                {section === "dashboard"
                  ? coach
                    ? "Your athletes. Your schedule. Your next priorities."
                    : "A clear view of what’s next, on and off the mound."
                  : athlete && segments[1]
                    ? `${athlete.first_name} ${athlete.last_name}`
                    : "Keep your next step in focus."}
              </p>
            </div>
            {!coach && data.athletes.length > 0 && (
              <label className="athlete-selector">
                ATHLETE
                <select
                  aria-label="ATHLETE"
                  value={selected}
                  onChange={(e) => {
                    setEditor(null);
                    setBooking(null);
                    setMessage("");
                    setSelected(e.target.value);
                  }}
                >
                  {data.athletes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.first_name} {a.last_name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {section === "dashboard" && (
            <>
              {coach && <CoachPriorities data={data} prefix={prefix} />}
              <div className="metric-grid">
                <article>
                  <span>
                    {coach ? "Upcoming sessions" : "Training credits"}
                  </span>
                  <strong>
                    {coach
                      ? upcoming.length
                      : available.toString().padStart(2, "0")}
                    <small>{coach ? "on the calendar" : "available"}</small>
                  </strong>
                  <Link href={`${prefix}/${coach ? "calendar" : "billing"}`}>
                    {coach ? "View calendar" : "Manage your coaching"}{" "}
                    <ArrowUpRight size={15} />
                  </Link>
                </article>
                <article>
                  <span>{coach ? "Athletes" : "Membership"}</span>
                  <strong>
                    {coach
                      ? data.athletes.length
                      : (data.coaching_status?.some(
                            (s) => s.athlete_id === aid && s.premium_active,
                          ) ?? subs.some((s) => s.status === "active"))
                        ? "Premium"
                        : subs.some((s) => s.status === "past_due")
                          ? "Payment issue"
                          : "Individual"}
                    <small>{coach ? "in your workspace" : "coaching"}</small>
                  </strong>
                  <p>
                    {coach
                      ? "Every athlete, a personal plan."
                      : subs[0]?.cancel_at_period_end
                        ? "Ends at the paid period boundary"
                        : "Build your next chapter."}
                  </p>
                </article>
                <article>
                  <span>Video analysis</span>
                  <strong>
                    {videos
                      .filter(
                        (v) => !["completed", "closed"].includes(v.status),
                      )
                      .length.toString()
                      .padStart(2, "0")}
                    <small>{coach ? "to review" : "in progress"}</small>
                  </strong>
                  <Link href={`${prefix}/video`}>
                    View {coach ? "queue" : "submissions"}{" "}
                    <ArrowUpRight size={15} />
                  </Link>
                </article>
              </div>
              <div className="dashboard-grid">
                <Panel
                  title={coach ? "Up next" : "Your next session"}
                  action={
                    <Link href={`${prefix}/${coach ? "calendar" : "lessons"}`}>
                      View all <ChevronRight size={16} />
                    </Link>
                  }
                >
                  {upcoming[0] ? (
                    <div className="next-lesson">
                      <div className="calendar-icon">
                        <CalendarDays size={30} />
                      </div>
                      <p className="eyebrow">
                        {upcoming[0].delivery_mode.replace("_", " ")} · 60
                        MINUTES
                      </p>
                      <h3>
                        {coach
                          ? athleteName(upcoming[0].athlete_id)
                          : "Time to get better."}
                      </h3>
                      <p>{formatTime(upcoming[0].starts_at)}</p>
                      <p className="muted">
                        {upcoming[0].location_name ||
                          "Training location coordinated with Coach Jacob."}
                      </p>
                      <Badge>Confirmed</Badge>
                    </div>
                  ) : (
                    <Empty title="Your next session is ahead">
                      Choose a time and put your development on the calendar.
                    </Empty>
                  )}
                </Panel>
                <Panel
                  title={coach ? "Athlete priorities" : "Keep your momentum"}
                >
                  <div className="focus-card">
                    <Target size={28} />
                    <h3>
                      {coach
                        ? "Make the next session count."
                        : "Small steps. Lasting progress."}
                    </h3>
                    <p>
                      {coach
                        ? `${videos.filter((v) => ["received", "in_review"].includes(v.status)).length} video reviews need feedback. Review plans and monthly reports in each athlete’s workspace.`
                        : available >= 2
                          ? "You have training sessions available. Keep your momentum going."
                          : "Your coach is here to help you turn intention into action."}
                    </p>
                    {coach ? (
                      <Link
                        className="button light"
                        href={`${prefix}/athletes`}
                      >
                        Open Athletes <ArrowUpRight size={16} />
                      </Link>
                    ) : (
                      bookButton
                    )}
                  </div>
                </Panel>
              </div>
              {plansPanel}
              {!coach && reportsPanel}
              {!coach &&
                credits.some(
                  (c) =>
                    c.remaining > 0 &&
                    c.expires_at &&
                    new Date(c.expires_at).getTime() <
                      Date.now() + 14 * 86400000,
                ) && (
                  <p role="status" className="notice">
                    Credits for {athlete?.first_name} expire within 14 days.
                    Review their expiration before booking.
                  </p>
                )}
              {coach && (
                <Panel title="Recent activity">
                  {data.activity?.length ? (
                    data.activity.map((a, i) => (
                      <p key={i}>
                        {a.action.replaceAll("_", " ")}{" "}
                        <small>{formatTime(a.created_at)}</small>
                      </p>
                    ))
                  ) : (
                    <Empty title="Ready for the next chapter">
                      Coaching actions will appear here.
                    </Empty>
                  )}
                </Panel>
              )}
            </>
          )}
          {section === "athletes" && !segments[1] && (
            <Panel
              title={coach ? "Your athletes" : "Your family’s athletes"}
              action={
                !coach &&
                data.profile.role === "parent" && (
                  <Button onClick={() => addAthlete()}>
                    <Plus size={16} /> Add Athlete
                  </Button>
                )
              }
            >
              <div className="athlete-grid">
                {data.athletes.map((a) => (
                  <article className="athlete-card" key={a.id}>
                    <span className="avatar large">
                      {a.first_name[0]}
                      {a.last_name[0]}
                    </span>
                    <h3>
                      {a.first_name} {a.last_name}
                    </h3>
                    <p>
                      {a.competitive_level.replaceAll("_", " ")} · {a.throws}HP
                    </p>
                    <p>{a.goals}</p>
                    {coach ? (
                      <Link
                        className="button outline"
                        href={`${prefix}/athletes/${a.id}`}
                      >
                        Open Workspace <ArrowUpRight size={16} />
                      </Link>
                    ) : (
                      <div className="actions">
                        <button onClick={() => addAthlete(a)}>
                          Edit profile
                        </button>
                        {!a.athlete_user_id && (
                          <button
                            onClick={() =>
                              setEditor({
                                title: "Invite athlete login",
                                fields: [
                                  text("email", "Athlete email", "email"),
                                ],
                                submit: async (p) => {
                                  if (demo)
                                    throw new Error(
                                      "Invitations are disabled in preview.",
                                    );
                                  const result = await api<{ url: string }>(
                                    `/athletes/${a.id}/invite`,
                                    p,
                                  );
                                  setMessage(
                                    `Share this private invitation with your athlete: ${result.url}`,
                                  );
                                  setEditor(null);
                                },
                              })
                            }
                          >
                            Invite login
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
              {!data.athletes.length && (
                <Empty title="Add your first athlete">
                  A parent can manage multiple athletes from one account.
                </Empty>
              )}
            </Panel>
          )}
          {section === "athletes" && segments[1] && athlete && (
            <>
              <Panel title={`${athlete.first_name} ${athlete.last_name}`}>
                <Badge>{athlete.competitive_level.replaceAll("_", " ")}</Badge>
                <p>
                  {athlete.school} · Throws {athlete.throws} · Class of{" "}
                  {athlete.graduation_year || "—"}
                </p>
                <p>{athlete.goals}</p>
                <p>
                  Guardian:{" "}
                  {data.customers?.find((c) => c.id === athlete.owner_parent_id)
                    ?.email || "Independent athlete"}
                </p>
                <p>
                  {available} available training credits ·{" "}
                  {subs[0]?.status || "No membership"}
                </p>
              </Panel>
              {lessonsPanel}
              {plansPanel}
              {reportsPanel}
              {videosPanel}
              <Panel
                title="Coach notes"
                action={
                  <Button
                    onClick={() =>
                      setEditor({
                        title: "Add coaching note",
                        fields: [
                          text("content", "Note", "textarea"),
                          opts("visibility", "Visibility", [
                            "private",
                            "customer_visible",
                          ]),
                        ],
                        initial: { visibility: "private" },
                        submit: (p) =>
                          write("/coach/notes", { ...p, athlete_id: aid }),
                      })
                    }
                  >
                    Add Note
                  </Button>
                }
              >
                {scoped(data.notes).map((n) => (
                  <article className="report" key={n.id}>
                    <Badge>{n.visibility}</Badge>
                    <p>{n.content}</p>
                  </article>
                ))}
              </Panel>
            </>
          )}
          {(section === "lessons" || section === "calendar") && (
            <>
              {coach && (
                <Availability
                  demo={demo}
                  actor={data.profile.id}
                  onEdit={setEditor}
                  write={write}
                />
              )}{" "}
              {lessonsPanel}
            </>
          )}
          {section === "video" && videosPanel}
          {section === "plans" && plansPanel}
          {section === "progress" && reportsPanel}
          {(section === "billing" || section === "products") && !minor && (
            <>
              <Panel
                title={coach ? "Coaching programs" : "Choose your next step"}
              >
                <div className="billing-products">
                  {data.products.map((p) => (
                    <article key={p.id} className="billing-product">
                      <Badge>{p.product_type.replaceAll("_", " ")}</Badge>
                      <h3>{p.name}</h3>
                      <strong className="billing-price">
                        {dollars(p.price_cents)}
                        <small>{p.billing_interval ? "/month" : ""}</small>
                      </strong>
                      <p>{p.description}</p>
                      {coach ? (
                        <Button
                          disabled={data.profile.role !== "admin"}
                          onClick={() =>
                            setEditor({
                              title: `Edit ${p.name}`,
                              fields: [
                                text("name", "Program name"),
                                text("description", "Description", "textarea"),
                                text("price_cents", "Price in cents", "number"),
                                text(
                                  "benefits_text",
                                  "Benefits (one per line)",
                                  "textarea",
                                ),
                                text(
                                  "capacity",
                                  "Capacity override (optional)",
                                  "number",
                                  false,
                                ),
                                {
                                  name: "active",
                                  label: "Available for purchase",
                                  type: "checkbox",
                                },
                              ],
                              initial: {
                                ...p,
                                benefits_text: p.benefits.join("\n"),
                              },
                              submit: (d) =>
                                write(
                                  `/coach/products/${p.id}`,
                                  {
                                    name: d.name,
                                    description: d.description,
                                    price_cents: d.price_cents,
                                    benefits: String(d.benefits_text)
                                      .split("\n")
                                      .filter(Boolean),
                                    capacity: Number.isFinite(d.capacity)
                                      ? d.capacity
                                      : null,
                                    active: !!d.active,
                                  },
                                  "PATCH",
                                ),
                            })
                          }
                        >
                          Edit Program
                        </Button>
                      ) : (
                        <Button disabled={!aid} onClick={() => buy(p)}>
                          {p.full ? "Join Waitlist" : "Choose Program"}
                        </Button>
                      )}
                    </article>
                  ))}
                </div>
              </Panel>
              {!coach && (
                <>
                  <Panel
                    title="Membership & billing"
                    action={
                      <Button
                        onClick={() => act(() => write("/billing/portal", {}))}
                      >
                        Manage in Stripe ↗
                      </Button>
                    }
                  >
                    <p>
                      Update payment methods, view invoices, or manage your
                      subscription securely in the Stripe Billing Portal.
                    </p>
                    {subs.map((s) => (
                      <p key={s.id}>
                        <Badge>{s.status}</Badge> Paid period ends{" "}
                        {formatTime(s.current_period_end)}
                        {s.cancel_at_period_end
                          ? " · Cancels at period end"
                          : ""}
                      </p>
                    ))}
                    <p className="field-help">
                      After checkout, your purchase appears once Stripe confirms
                      payment. A return to this page does not confirm payment.
                    </p>
                  </Panel>
                  <Panel title="Credit balance">
                    {credits.length ? (
                      credits.map((c) => (
                        <div className="list-row" key={c.id}>
                          <strong>
                            {c.remaining} of {c.quantity}{" "}
                            {c.kind.replace("_", " ")} credits
                          </strong>
                          <span>
                            {c.expires_at
                              ? `Expires ${formatTime(c.expires_at)}`
                              : "No expiration"}
                          </span>
                        </div>
                      ))
                    ) : (
                      <Empty title="No available credits">
                        Choose a program to begin.
                      </Empty>
                    )}
                  </Panel>
                  <Panel title="Purchase history">
                    {scoped(data.orders).length ? (
                      scoped(data.orders).map((o) => (
                        <div className="list-row" key={o.id}>
                          <span>{formatTime(o.created_at)}</span>
                          <strong>{dollars(o.total_cents)}</strong>
                          <Badge>{o.status}</Badge>
                        </div>
                      ))
                    ) : (
                      <Empty title="Your purchases will appear here">
                        Stripe securely handles all payments.
                      </Empty>
                    )}
                  </Panel>
                </>
              )}
            </>
          )}
          {section === "customers" && coach && (
            <Panel title="Customer directory">
              {data.customers?.map((p) => (
                <div className="list-row" key={p.id}>
                  <strong>
                    {p.first_name} {p.last_name}
                  </strong>
                  <span>{p.email}</span>
                  <Badge>{p.role}</Badge>
                </div>
              ))}
              {!data.customers?.length && (
                <Empty title="No customers yet">
                  Verified accounts appear here.
                </Empty>
              )}
            </Panel>
          )}
          {section === "revenue" && coach && <RevenuePanel demo={demo} />}
          {section === "settings" && coach && (
            <Panel title="Business settings">
              <DataForm
                fields={Object.entries(data.settings).map(([name, value]) => ({
                  name,
                  label: name.replaceAll("_", " "),
                  type:
                    typeof value === "boolean"
                      ? "checkbox"
                      : typeof value === "number"
                        ? "number"
                        : "text",
                  required: !["business_email", "business_phone"].includes(
                    name,
                  ),
                }))}
                initial={{ ...data.settings }}
                submit={(p) => write("/coach/settings", p, "PATCH")}
              />
            </Panel>
          )}
          {section === "account" && (
            <Panel title="Your account">
              <DataForm
                fields={[
                  text("first_name", "First name"),
                  text("last_name", "Last name"),
                  text("phone", "Phone (optional)", "text", false),
                ]}
                initial={{
                  first_name: data.profile.first_name,
                  last_name: data.profile.last_name,
                  phone: data.profile.phone || "",
                }}
                submit={(p) => write("/me", p, "PATCH")}
              />
              <p>{data.profile.email}</p>
              <Link href="/forgot-password">Reset password</Link>
            </Panel>
          )}
        </main>
        <div className="hub-footer">
          PITCH LAB ATHLETICS{" "}
          <span>Develop with intent. Compete with confidence.</span>
        </div>
      </div>
      {editor && (
        <Modal title={editor.title} close={() => setEditor(null)}>
          <DataForm
            fields={editor.fields}
            initial={editor.initial}
            submit={editor.submit}
            label={editor.label}
          />
        </Modal>
      )}
      {booking && (
        <SlotPicker
          athlete_id={aid}
          athleteName={athleteName(aid)}
          reschedule={booking.reschedule}
          close={() => setBooking(null)}
          saved={() => {
            refresh();
            setMessage("Lesson saved.");
          }}
          demo={demo}
        />
      )}
    </div>
  );
}
