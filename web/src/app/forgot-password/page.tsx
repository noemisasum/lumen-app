"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Notice, Spinner } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type FormState =
  | { tone: "error"; title: string; detail?: string }
  | { tone: "success"; title: string; detail?: string }
  | null;

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<FormState>(
    supabase
      ? null
      : {
          tone: "error",
          title: "Password Recovery Is Not Configured",
          detail: "Supabase connection settings are missing for this deployment.",
        },
  );

  async function requestReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) {
      setState({
        tone: "error",
        title: "Password Recovery Is Not Configured",
        detail: "Ask an administrator to add the Supabase URL and public anon key before requesting a reset.",
      });
      return;
    }

    setLoading(true);
    setState(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;

      setState({
        tone: "success",
        title: "Check Your Email",
        detail: "If that account exists, Supabase will send a secure password reset link.",
      });
    } catch (err: unknown) {
      setState({
        tone: "error",
        title: "Could Not Send Reset Link",
        detail: getErrorMessage(err, "Please check the email address and try again."),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Account Recovery"
      title="Reset Your Lumen Password."
      subtitle="Request a secure reset link for the email attached to your Lumen account."
      actionHref="/login"
      actionLabel="Sign In"
    >
      <div>
        <h2 className="text-lg font-semibold text-zinc-950">Forgot Password</h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-zinc-950 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950">
            Back to Sign In
          </Link>
        </p>
      </div>

      <form onSubmit={requestReset} className="mt-5 space-y-4">
        <div className="space-y-2">
          <label htmlFor="recovery-email" className="text-sm font-medium text-zinc-800">
            Account Email
          </label>
          <input
            id="recovery-email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            required
            disabled={loading || !supabase}
            className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
            placeholder="you@company.com"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !supabase}
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {loading ? <Spinner label="Sending Reset Link" /> : "Send Reset Link"}
        </button>

        <div className="min-h-[76px]">
          {state ? (
            <Notice tone={state.tone} title={state.title}>
              {state.detail}
            </Notice>
          ) : null}
        </div>
      </form>
    </AuthShell>
  );
}
