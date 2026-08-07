import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f7f6f2] text-zinc-950">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex min-h-11 items-center justify-between gap-4">
          <Link href="/" className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-950">
            <BrandLogo className="h-6 w-auto sm:h-7" />
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
          >
            Get Started
          </Link>
        </header>

        <main className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_430px]">
          <section className="min-w-0 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[#b8942e]" />
              Cash Visibility · Reconciliation · Intelligence
            </div>

            <h1 className="mt-6 max-w-full break-words text-4xl font-semibold tracking-normal text-zinc-950 sm:text-5xl">
              Treasury Visibility Without the Month-End Scramble.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-zinc-700 sm:text-lg">
              Lumen App gives finance teams a calm operating surface for book balances, bank-confirmed positions, and reconciliation variance.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/signup"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-950 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
              >
                Start With Email
              </Link>
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
              >
                Sign In
              </Link>
            </div>
          </section>

          <section className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-3">
              <div>
                <div className="text-sm font-semibold text-zinc-950">Group Cash Position</div>
                <div className="mt-1 text-xs text-zinc-500">Today · USD Consolidated</div>
              </div>
              <div className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">Balanced</div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-zinc-200 p-3">
                <div className="text-xs text-zinc-500">Book Balance</div>
                <div className="mt-2 text-xl font-semibold">$4.82M</div>
              </div>
              <div className="rounded-lg border border-zinc-200 p-3">
                <div className="text-xs text-zinc-500">Bank Balance</div>
                <div className="mt-2 text-xl font-semibold">$4.79M</div>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
              {[
                ["Operating", "$2.14M", "Matched"],
                ["Payroll", "$840K", "Review"],
                ["AP clearing", "$1.81M", "Matched"],
              ].map(([name, amount, status]) => (
                <div
                  key={name}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-zinc-100 px-3 py-3 text-sm last:border-b-0"
                >
                  <div className="min-w-0 truncate font-medium text-zinc-900">{name}</div>
                  <div className="text-zinc-700">{amount}</div>
                  <div className={status === "Matched" ? "text-emerald-700" : "text-amber-700"}>{status}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">
              Variance is concentrated in payroll timing. Statement intake is ready for the controller review queue.
            </div>
          </section>
        </main>

        <section className="grid gap-3 pb-8 sm:grid-cols-3">
          {[
            { title: "Book Balances", desc: "Recurring visibility from connected accounting systems." },
            { title: "Actual Balances", desc: "Bank-confirmed snapshots from uploaded statements." },
            { title: "AI Briefings", desc: "Source-linked commentary from validated treasury data." },
          ].map((x) => (
            <div key={x.title} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">{x.title}</div>
              <div className="mt-1 text-sm leading-6 text-zinc-600">{x.desc}</div>
            </div>
          ))}
        </section>

        <footer className="py-5 text-xs text-zinc-500">© {new Date().getFullYear()} Lumen App</footer>
      </div>
    </div>
  );
}
