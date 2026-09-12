"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Brand } from "./brand";
import { auth, api, ApiFailure } from "../lib/api";
import type { Profile } from "@pitch/contracts";
import { Button } from "@pitch/ui";
const schema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(10, "Use at least 10 characters."),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  date_of_birth: z.string().optional(),
});
type Fields = z.infer<typeof schema>;
export function AuthForm({
  mode,
}: {
  mode: "login" | "signup" | "forgot" | "reset" | "callback";
}) {
  const router = useRouter();
  const [role, setRole] = useState<"parent" | "athlete">("parent");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [invite, setInvite] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({
    resolver: zodResolver(
      mode === "signup" || mode === "login"
        ? schema
        : mode === "forgot"
          ? schema.pick({ email: true })
          : schema.pick({ password: true }),
    ),
  });
  useEffect(() => {
    setInvite(
      new URLSearchParams(window.location.search).get("invite") ||
        sessionStorage.getItem("pitch-invite") ||
        "",
    );
  }, []);
  async function finish() {
    const client = auth();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) throw new Error("Verify your email and sign in to continue.");
    const token = invite || sessionStorage.getItem("pitch-invite");
    if (token) {
      await api("/invites/accept", { token });
      sessionStorage.removeItem("pitch-invite");
    }
    let profile: Profile;
    try {
      profile = (await api<{ data: Profile }>("/me")).data;
    } catch (e) {
      if (e instanceof ApiFailure && e.code === "ONBOARDING_REQUIRED") {
        const d = user.user_metadata;
        profile = (
          await api<{ data: Profile }>("/onboarding", {
            role: d.account_role,
            first_name: d.first_name,
            last_name: d.last_name,
            date_of_birth: d.date_of_birth,
          })
        ).data;
      } else throw e;
    }
    router.replace(
      ["coach", "admin"].includes(profile.role) ? "/coach" : "/app",
    );
  }
  useEffect(() => {
    if (mode === "callback") {
      void finish().catch((e) =>
        setError(e instanceof Error ? e.message : "Please sign in again."),
      );
    }
  }, [mode]); // Callback completes only once for the newly established session.
  const submit = handleSubmit(async (p) => {
    setError("");
    setSuccess("");
    try {
      const client = auth();
      if (mode === "signup") {
        if (!p.first_name?.trim() || !p.last_name?.trim() || !p.date_of_birth)
          throw new Error("Enter your name and birth date.");
        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - 18);
        if (!invite && new Date(`${p.date_of_birth}T00:00:00`) > cutoff)
          throw new Error(
            role === "athlete"
              ? "Your parent or guardian needs to create the account first. Athletes 13–17 can use a guardian invitation."
              : "A parent or guardian account must be created by an adult.",
          );
        if (invite) sessionStorage.setItem("pitch-invite", invite);
        const { data, error } = await client.auth.signUp({
          email: p.email,
          password: p.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              account_role: role,
              first_name: p.first_name,
              last_name: p.last_name,
              date_of_birth: p.date_of_birth,
            },
          },
        });
        if (error) throw error;
        if (data.session) await finish();
        else
          setSuccess(
            "Check your email to verify your account. Then return here to sign in.",
          );
      } else if (mode === "login") {
        const { error } = await client.auth.signInWithPassword({
          email: p.email,
          password: p.password,
        });
        if (error) throw error;
        await finish();
      } else if (mode === "forgot") {
        const { error } = await client.auth.resetPasswordForEmail(p.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSuccess(
          "If an account exists for that address, a reset link is on its way.",
        );
      } else {
        const { error } = await client.auth.updateUser({
          password: p.password,
        });
        if (error) throw error;
        setSuccess("Password updated. You can now sign in.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    }
  });
  return (
    <div className="auth-shell">
      <aside className="auth-story">
        <Brand />
        <div>
          <p className="eyebrow">PITCH LAB ATHLETICS</p>
          <h2>
            Develop with intent.
            <br />
            <span>Compete with confidence.</span>
          </h2>
          <p>
            Your coaching. Your progress.
            <br />
            One place to keep moving forward.
          </p>
        </div>
        <small>Corpus Christi, Texas · Local + remote</small>
      </aside>
      <main id="main" className="auth-main">
        <Link className="back-link" href="/">
          ← Back to Pitch Lab
        </Link>
        <div className="auth-card">
          <p className="eyebrow">ATHLETE HUB</p>
          <h1>
            {mode === "signup"
              ? "Your development starts here."
              : mode === "forgot"
                ? "Reset your password."
                : mode === "reset"
                  ? "Choose a new password."
                  : mode === "callback"
                    ? "Finishing your sign-in."
                    : "Welcome back."}
          </h1>
          <p>
            {mode === "signup"
              ? "Create your account and build your coaching relationship."
              : "Sign in to your next step."}
          </p>
          {mode === "signup" && !invite && (
            <fieldset className="role-picker">
              <legend>Who are you creating this account for?</legend>
              <label>
                <input
                  type="radio"
                  checked={role === "parent"}
                  onChange={() => setRole("parent")}
                />{" "}
                I’m a parent or guardian
              </label>
              <label>
                <input
                  type="radio"
                  checked={role === "athlete"}
                  onChange={() => setRole("athlete")}
                />{" "}
                I’m the athlete
              </label>
            </fieldset>
          )}
          {invite && (
            <p className="notice">You’re accepting a guardian invitation.</p>
          )}
          {mode !== "callback" && (
            <form onSubmit={submit}>
              {mode === "signup" && (
                <>
                  <label>
                    First name
                    <input
                      autoComplete="given-name"
                      {...register("first_name")}
                      required
                    />
                  </label>
                  <label>
                    Last name
                    <input
                      autoComplete="family-name"
                      {...register("last_name")}
                      required
                    />
                  </label>
                  <label>
                    Your date of birth
                    <input
                      type="date"
                      {...register("date_of_birth")}
                      required
                    />
                  </label>
                  <p className="field-help">
                    Under 13? Your parent manages your profile. Ages 13–17 need
                    a guardian invitation.
                  </p>
                </>
              )}
              {mode !== "reset" && (
                <label>
                  Email address
                  <input
                    type="email"
                    autoComplete="email"
                    {...register("email")}
                  />
                  {errors.email && (
                    <span className="field-error">{errors.email.message}</span>
                  )}
                </label>
              )}
              {mode !== "forgot" && (
                <label>
                  Password
                  <input
                    type="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    {...register("password")}
                  />
                  {errors.password && (
                    <span className="field-error">
                      {errors.password.message}
                    </span>
                  )}
                </label>
              )}
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              {success && (
                <p role="status" className="success">
                  {success}
                </p>
              )}
              <Button disabled={isSubmitting}>
                {isSubmitting
                  ? "Please wait…"
                  : mode === "signup"
                    ? "Create Account"
                    : mode === "forgot"
                      ? "Send Reset Link"
                      : mode === "reset"
                        ? "Update Password"
                        : "Sign In"}{" "}
                →
              </Button>
            </form>
          )}
          {mode === "callback" && (
            <p role="status">{error || "Checking your account…"}</p>
          )}
          <div className="auth-links">
            {mode === "login" ? (
              <>
                <Link href="/forgot-password">Forgot password?</Link>
                <p>
                  New to Pitch Lab?{" "}
                  <Link href="/signup">Create an account</Link>
                </p>
              </>
            ) : (
              <Link href="/login">Return to sign in</Link>
            )}
            <Link href="/preview">Explore the development preview ↗</Link>
          </div>
          <p className="fine-print">
            Account and coaching details stay private.{" "}
            <Link href="/privacy">Privacy</Link> ·{" "}
            <Link href="/terms">Terms</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
