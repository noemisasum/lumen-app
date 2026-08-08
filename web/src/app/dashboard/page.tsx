"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { Notice, SkeletonBlock, Spinner } from "@/components/ui";
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
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let unsub: { unsubscribe: () => void } | null = null;

    (async () => {
      try {
        if (!supabase) {
          setError("Authentication is not configured for this deployment.");
          setLoading(false);
          return;
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

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
        setError(getErrorMessage(e, "Failed to load your session."));
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      unsub?.unsubscribe();
    };
  }, [supabase]);

  async function signOut() {
    if (!supabase) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-[#f7f6f2] text-zinc-950">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex min-h-11 flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Link href="/" className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-950">
                <BrandLogo className="h-8 sm:h-9" />
              </Link>
              <div className="h-6 w-px bg-zinc-300" aria-hidden="true" />
              <div className="text-sm font-medium text-zinc-700">Dashboard</div>
            </div>
          </header>

          <main className="mt-8">
            <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="min-h-6 text-sm leading-6 text-zinc-600">
                {error ? (
                  <Notice tone="error" title="Authentication Needs Configuration">
                    {error}
                  </Notice>
                ) : (
                  <Spinner label="Checking Session" />
                )}
              </div>
            </section>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex min-h-11 flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/" className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-950">
              <BrandLogo className="h-8 sm:h-9" />
            </Link>
            <div className="h-6 w-px bg-zinc-300" aria-hidden="true" />
            <div className="text-sm font-medium text-zinc-700">Dashboard</div>
          </div>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut || !supabase}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
          >
            {signingOut ? "Signing Out" : "Sign Out"}
          </button>
        </header>

        <main className="mt-8 space-y-5">
          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#876b16]">Treasury Command Center</div>
                <h1 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950">Cash, Controls, and Intake in One Place.</h1>
                <div className="mt-3 min-h-6 text-sm leading-6 text-zinc-600">
                  Signed in as <span className="font-medium text-zinc-950">{session.email || session.userId}</span>
                </div>
              </div>
              <Link
                href="/dashboard/invoices"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
              >
                Open Statement Intake
              </Link>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {loading
              ? [0, 1, 2].map((item) => (
                  <div key={item} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                    <SkeletonBlock className="h-4 w-24" />
                    <SkeletonBlock className="mt-4 h-8 w-32" />
                    <SkeletonBlock className="mt-4 h-3 w-full" />
                    <SkeletonBlock className="mt-2 h-3 w-4/5" />
                  </div>
                ))
              : [
                  ["Book Balance", "$4.82M", "Consolidated across active entities"],
                  ["Bank-Confirmed", "$4.79M", "Latest statement-backed position"],
                  ["Open Variance", "$31.4K", "Two items queued for review"],
                ].map(([label, value, helper]) => (
                  <div key={label} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="text-sm font-medium text-zinc-600">{label}</div>
                    <div className="mt-3 text-2xl font-semibold text-zinc-950">{value}</div>
                    <div className="mt-3 text-sm leading-6 text-zinc-600">{helper}</div>
                  </div>
                ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-zinc-950">Reconciliation Queue</h2>
              </div>
              <div className="divide-y divide-zinc-100">
                {[
                  ["Payroll Sweep", "Timing difference", "$18.2K", "Review"],
                  ["AP Clearing", "Statement matched", "$0", "Ready"],
                  ["FX Settlement", "Awaiting bank feed", "$13.2K", "Pending"],
                ].map(([name, detail, amount, status]) => (
                  <div key={name} className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-zinc-950">{name}</div>
                      <div className="mt-1 text-zinc-600">{detail}</div>
                    </div>
                    <div className="font-medium text-zinc-900">{amount}</div>
                    <div className="w-fit rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">{status}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-zinc-950">Next Setup Steps</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-700">
                <li>Invite treasury users into their organisation.</li>
                <li>Connect accounting sources for recurring book balances.</li>
                <li>Upload bank statements through statement intake.</li>
              </ul>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
