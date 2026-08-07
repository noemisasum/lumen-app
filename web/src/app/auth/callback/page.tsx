"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { Notice, Spinner } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type CallbackStatus = "working" | "ok" | "error";

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function AuthCallbackPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [status, setStatus] = useState<CallbackStatus>("working");
  const [message, setMessage] = useState<string>("Completing secure sign-in.");

  useEffect(() => {
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;

    async function completeSignIn() {
      try {
        if (!supabase) {
          setStatus("error");
          setMessage("Authentication is not configured for this deployment.");
          return;
        }

        const url = new URL(window.location.href);
        const callbackError = url.searchParams.get("error_description") || url.searchParams.get("error");
        if (callbackError) throw new Error(callbackError);

        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) {
          throw new Error("We could not find an active session. The link may have expired.");
        }

        setStatus("ok");
        setMessage("You are signed in. Opening your dashboard.");
        redirectTimer = setTimeout(() => {
          window.location.replace("/dashboard");
        }, 500);
      } catch (err: unknown) {
        setStatus("error");
        setMessage(getErrorMessage(err, "Failed to complete sign-in."));
      }
    }

    completeSignIn();

    return () => {
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [supabase]);

  return (
    <div className="min-h-screen bg-[#f7f6f2] px-4 py-5 text-zinc-950 sm:px-6">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-950">
          <BrandLogo className="h-6 w-auto sm:h-7" />
        </Link>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-76px)] w-full max-w-md items-center">
        <section className="w-full rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#876b16]">Authentication</div>
          <h1 className="mt-3 text-xl font-semibold text-zinc-950">Finishing Sign In</h1>
          <div className="mt-4 min-h-[76px]">
            {status === "working" ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3">
                <Spinner label={message} />
              </div>
            ) : status === "ok" ? (
              <Notice tone="success" title="Signed In">
                {message}
              </Notice>
            ) : (
              <Notice tone="error" title="Sign-In Link Could Not Be Completed">
                {message}
              </Notice>
            )}
          </div>

          {status === "error" ? (
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
              >
                Back to Login
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
              >
                Request a New Link
              </Link>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
