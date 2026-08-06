"use client";

import { useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function SignupPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function signUpWithEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setMsg("Missing Supabase env vars.");
      return;
    }

    setLoading(true);
    setMsg(null);
    try {
      const emailRedirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo },
      });
      if (error) throw error;
      setMsg("Check your email.");
    } catch (err: unknown) {
      setMsg(getErrorMessage(err, "Sign up failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="flex min-h-screen items-center justify-center p-8">
        <main className="w-full max-w-sm rounded-2xl bg-white p-6 shadow">
          <div className="flex flex-col items-center gap-2">
            <img src="/lumen-app-logo.jpg" alt="Lumen App" className="h-6 w-auto" />
            <h1 className="text-base font-semibold">Sign-up</h1>
            <div className="text-xs text-zinc-400">
              Already have an account?{" "}
              <a href="/login" className="font-medium text-zinc-900 underline underline-offset-2">
                Sign in
              </a>
            </div>
          </div>

          <form onSubmit={signUpWithEmail} className="mt-4 space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-10 w-full rounded-lg bg-black px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {loading ? "…" : "Continue"}
            </button>

            {msg ? <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{msg}</div> : null}

            {!supabase ? <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Missing Supabase env vars.</div> : null}
          </form>
        </main>
      </div>
    </div>
  );
}
