"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Notice, Spinner } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type FormState =
  | { tone: "error"; title: string; detail?: string }
  | { tone: "success"; title: string; detail?: string }
  | { tone: "info"; title: string; detail?: string }
  | null;

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function ResetPasswordPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<FormState>(
    supabase
      ? { tone: "info", title: "Checking Reset Link", detail: "Validating your secure recovery session." }
      : {
          tone: "error",
          title: "Password Reset Is Not Configured",
          detail: "Supabase connection settings are missing for this deployment.",
        },
  );

  useEffect(() => {
    async function prepareResetSession() {
      if (!supabase) {
        setChecking(false);
        return;
      }

      try {
        const url = new URL(window.location.href);
        const callbackError = url.searchParams.get("error_description") || url.searchParams.get("error");
        if (callbackError) throw new Error(callbackError);

        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          window.history.replaceState({}, document.title, "/reset-password");
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) throw new Error("This reset link has expired. Request a fresh password reset email.");

        setReady(true);
        setState(null);
      } catch (err: unknown) {
        setReady(false);
        setState({
          tone: "error",
          title: "Reset Link Could Not Be Used",
          detail: getErrorMessage(err, "Request a fresh password reset email and try again."),
        });
      } finally {
        setChecking(false);
      }
    }

    void prepareResetSession();
  }, [supabase]);

  async function updatePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !ready) return;

    if (password.length < 8) {
      setState({
        tone: "error",
        title: "Choose a Longer Password",
        detail: "Use at least 8 characters for your Lumen password.",
      });
      return;
    }

    if (password !== confirmPassword) {
      setState({
        tone: "error",
        title: "Passwords Do Not Match",
        detail: "Enter the same password in both fields before saving.",
      });
      return;
    }

    setLoading(true);
    setState(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setState({
        tone: "success",
        title: "Password Updated",
        detail: "Your new password is active. You can continue to the dashboard.",
      });
      setPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setState({
        tone: "error",
        title: "Could Not Update Password",
        detail: getErrorMessage(err, "Please try again or request a fresh reset link."),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Account Recovery"
      title="Create a New Password."
      subtitle="Use your recovery link to choose a new password for your Lumen account."
      actionHref="/login"
      actionLabel="Sign In"
    >
      <div>
        <h2 className="text-lg font-semibold text-zinc-950">New Password</h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          Need another link?{" "}
          <Link href="/forgot-password" className="font-medium text-zinc-950 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950">
            Request Password Reset
          </Link>
        </p>
      </div>

      <form onSubmit={updatePassword} className="mt-5 space-y-4">
        <div className="space-y-2">
          <label htmlFor="new-password" className="text-sm font-medium text-zinc-800">
            New Password
          </label>
          <input
            id="new-password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={checking || loading || !ready}
            className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
            placeholder="Create a new password"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="confirm-new-password" className="text-sm font-medium text-zinc-800">
            Confirm New Password
          </label>
          <input
            id="confirm-new-password"
            name="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={checking || loading || !ready}
            className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
            placeholder="Repeat your new password"
          />
        </div>

        <button
          type="submit"
          disabled={checking || loading || !ready}
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {loading ? <Spinner label="Updating Password" /> : checking ? <Spinner label="Checking Reset Link" /> : "Update Password"}
        </button>

        <div className="min-h-[76px]">
          {state ? (
            <Notice tone={state.tone} title={state.title}>
              {state.detail}
            </Notice>
          ) : null}
        </div>

        {state?.tone === "success" ? (
          <Link
            href="/dashboard"
            className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
          >
            Open Dashboard
          </Link>
        ) : null}
      </form>
    </AuthShell>
  );
}
