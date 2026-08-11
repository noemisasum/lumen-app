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

function getSignupErrorDetail(err: unknown) {
  const message = getErrorMessage(err, "Please check the email address and try again.");
  const normalized = message.toLowerCase();

  if (normalized.includes("failed to fetch") || normalized.includes("networkerror") || normalized.includes("load failed")) {
    return "Lumen could not reach Supabase from this browser. Ask an administrator to verify NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, the Supabase project status, and the Auth redirect URL allowlist for this deployment.";
  }

  if (normalized.includes("invalid api key") || normalized.includes("jwt")) {
    return "Lumen's Supabase public anon key appears to be invalid for this deployment. Ask an administrator to update NEXT_PUBLIC_SUPABASE_ANON_KEY.";
  }

  if (normalized.includes("redirect") || normalized.includes("not allowed")) {
    return "Supabase rejected this sign-up redirect. Ask an administrator to add this deployment URL and /auth/callback to the Supabase Auth URL configuration.";
  }

  return message;
}

export default function SignupPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<FormState>(
    supabase
      ? null
      : {
          tone: "error",
          title: "Sign Up Is Not Configured",
          detail: "Supabase connection settings are missing for this deployment. The rest of the app can still be reviewed.",
        },
  );

  async function signUpWithEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) {
      setState({
        tone: "error",
        title: "Sign Up Is Not Configured",
        detail: "Ask an administrator to add the Supabase URL and public anon key before inviting users.",
      });
      return;
    }

    setLoading(true);
    setState(null);
    try {
      const emailRedirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo,
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      setState({
        tone: "success",
        title: "Check Your Email",
        detail: "We sent a secure sign-in link. Open it in this browser to finish creating your Lumen account.",
      });
    } catch (err: unknown) {
      setState({
        tone: "error",
        title: "Could Not Send the Sign-Up Link",
        detail: getSignupErrorDetail(err),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Secure Onboarding"
      title="Create Your Treasury Workspace."
      subtitle="Start with an email link. Once confirmed, Lumen opens your dashboard so your team can begin reviewing cash and reconciliation activity."
    >
      <div>
        <h2 className="text-lg font-semibold text-zinc-950">Sign Up</h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-zinc-950 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950">
            Sign In
          </Link>
        </p>
      </div>

      <form onSubmit={signUpWithEmail} className="mt-5 space-y-4" noValidate={false}>
        <div className="space-y-2">
          <label htmlFor="signup-email" className="text-sm font-medium text-zinc-800">
            Work Email
          </label>
          <input
            id="signup-email"
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
          <p className="min-h-5 text-xs leading-5 text-zinc-500">No password is needed for email-link signup.</p>
        </div>

        <button
          type="submit"
          disabled={loading || !supabase}
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {loading ? <Spinner label="Sending Link" /> : "Send Sign-Up Link"}
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
