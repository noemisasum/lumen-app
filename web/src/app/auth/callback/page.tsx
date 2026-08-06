"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function AuthCallbackPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState<string>("Completing sign-in…");

  useEffect(() => {
    (async () => {
      try {
        if (!supabase) {
          setStatus("error");
          setMessage("Missing Supabase env vars on this deployment.");
          return;
        }
        // For OAuth PKCE: exchange code in URL for a session.
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) throw error;
        setStatus("ok");
        setMessage("Signed in. Redirecting…");
        window.location.replace("/");
      } catch (err: unknown) {
        setStatus("error");
        setMessage(getErrorMessage(err, "Failed to complete sign-in"));
      }
    })();
  }, [supabase]);

  return (
    <div className="min-h-screen bg-zinc-50 p-8 text-zinc-900">
      <main className="mx-auto w-full max-w-md space-y-3 rounded-xl bg-white p-6 shadow">
        <h1 className="text-xl font-semibold">Auth callback</h1>
        <p className="text-sm text-zinc-600">{message}</p>
        <div className="text-xs text-zinc-500">Status: {status}</div>
      </main>
    </div>
  );
}
