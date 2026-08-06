"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type SessionInfo = {
  userId: string;
  email: string | null;
};

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function DashboardPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsub: { unsubscribe: () => void } | null = null;

    (async () => {
      try {
        if (!supabase) {
          setError("Missing Supabase env vars.");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!data.session) {
          window.location.replace("/login");
          return;
        }

        setSession({
          userId: data.session.user.id,
          email: data.session.user.email ?? null,
        });

        const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
          if (!sess) {
            window.location.replace("/login");
            return;
          }
          setSession({ userId: sess.user.id, email: sess.user.email ?? null });
        });
        unsub = sub.subscription;
      } catch (e: unknown) {
        setError(getErrorMessage(e, "Failed to load session"));
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      try {
        unsub?.unsubscribe();
      } catch {
        // ignore
      }
    };
  }, [supabase]);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/lumen-app-logo.jpg" alt="Lumen App" className="h-7 w-auto" />
            <div className="text-sm font-medium text-zinc-700">Dashboard</div>
          </div>
          <button
            onClick={signOut}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Sign out
          </button>
        </header>

        <main className="mt-10 space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
            <div className="text-sm font-semibold">Welcome</div>
            {loading ? (
              <div className="mt-2 text-sm text-zinc-600">Loading…</div>
            ) : error ? (
              <div className="mt-2 text-sm text-amber-700">{error}</div>
            ) : session ? (
              <div className="mt-2 text-sm text-zinc-600">
                Signed in as <span className="font-medium text-zinc-900">{session.email || session.userId}</span>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <a href="#" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-100 hover:bg-zinc-50">
              <div className="text-sm font-semibold">Cash positions</div>
              <div className="mt-1 text-sm text-zinc-600">Review group, entity, bank, and account balances.</div>
            </a>
            <a href="#" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-100 hover:bg-zinc-50">
              <div className="text-sm font-semibold">Reconciliations</div>
              <div className="mt-1 text-sm text-zinc-600">Compare book balances against actual bank balances.</div>
            </a>
            <a href="/dashboard/invoices" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-100 hover:bg-zinc-50">
              <div className="text-sm font-semibold">Statement intake</div>
              <div className="mt-1 text-sm text-zinc-600">Reuse the existing upload flow for statement ingestion.</div>
            </a>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
            <div className="text-sm font-semibold">Next steps</div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-700">
              <li>Define treasury roles and organisation memberships.</li>
              <li>Create balance snapshot, statement upload, and reconciliation tables.</li>
              <li>Add Xero OAuth, book-balance sync, and source labels.</li>
            </ul>
          </div>
        </main>
      </div>
    </div>
  );
}
