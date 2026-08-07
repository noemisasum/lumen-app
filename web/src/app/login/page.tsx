"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Notice, Spinner } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type FormState = { title: string; detail?: string } | null;

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function LoginPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<FormState>(
    supabase
      ? null
      : {
          title: "Login is not configured",
          detail: "Supabase connection settings are missing for this deployment. Add them before users can authenticate.",
        },
  );

  async function signInPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) {
      setState({
        title: "Login is not configured",
        detail: "Ask an administrator to add the Supabase URL and public anon key before signing in.",
      });
      return;
    }
    setLoading(true);
    setState(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.assign("/dashboard");
    } catch (err: unknown) {
      setState({
        title: "Could not sign you in",
        detail: getErrorMessage(err, "Check your email and password, then try again."),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Treasury operations"
      title="Sign in to your Lumen dashboard."
      subtitle="Use password authentication for returning users. Email-link onboarding is available from the signup page."
      actionHref="/signup"
      actionLabel="Sign up"
    >
      <div>
        <h2 className="text-lg font-semibold text-zinc-950">Sign in</h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          New to Lumen?{" "}
          <Link href="/signup" className="font-medium text-zinc-950 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950">
            Create an account
          </Link>
        </p>
      </div>

      <form onSubmit={signInPassword} className="mt-5 space-y-4">
        <div className="space-y-2">
          <label htmlFor="login-email" className="text-sm font-medium text-zinc-800">
            Email
          </label>
          <input
            id="login-email"
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

        <div className="space-y-2">
          <label htmlFor="login-password" className="text-sm font-medium text-zinc-800">
            Password
          </label>
          <input
            id="login-password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
            disabled={loading || !supabase}
            className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
            placeholder="Enter your password"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !supabase}
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {loading ? <Spinner label="Signing in" /> : "Sign in"}
        </button>

        <div className="min-h-[76px]">
          {state ? (
            <Notice tone="error" title={state.title}>
              {state.detail}
            </Notice>
          ) : null}
        </div>
      </form>
    </AuthShell>
  );
}
