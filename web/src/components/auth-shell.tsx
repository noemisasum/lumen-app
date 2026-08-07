import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  actionHref = "/login",
  actionLabel = "Sign In",
}: {
  eyebrow: string;
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="min-h-screen bg-[#f7f6f2] text-zinc-950">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex min-h-11 items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-950">
            <BrandLogo className="h-6 w-auto sm:h-7" />
          </Link>
          <Link
            href={actionHref}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
          >
            {actionLabel}
          </Link>
        </header>

        <main className="grid w-full min-w-0 flex-1 grid-cols-1 items-center gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:py-10">
          <section className="w-full min-w-0 max-w-xl">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#876b16]">{eyebrow}</div>
            <h1 className="mt-3 max-w-full break-words text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
              {title}
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-zinc-700">{subtitle}</p>
            <div className="mt-8 grid w-full min-w-0 grid-cols-1 gap-3 text-sm text-zinc-700 sm:grid-cols-3 lg:max-w-2xl">
              <div className="rounded-lg border border-zinc-200 bg-white/70 p-3">
                <div className="font-medium text-zinc-950">Cash</div>
                <div className="mt-1 text-xs leading-5">Position visibility by entity and account.</div>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white/70 p-3">
                <div className="font-medium text-zinc-950">Control</div>
                <div className="mt-1 text-xs leading-5">Auditable reconciliation workflows.</div>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white/70 p-3">
                <div className="font-medium text-zinc-950">Briefs</div>
                <div className="mt-1 text-xs leading-5">Source-linked treasury context.</div>
              </div>
            </div>
          </section>

          <section className="w-full min-w-0 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            {children}
          </section>
        </main>
      </div>
    </div>
  );
}
