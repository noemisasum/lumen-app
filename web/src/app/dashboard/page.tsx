"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { Notice, SkeletonBlock, Spinner } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type SessionInfo = {
  userId: string;
  email: string | null;
  accessToken: string;
};

type XeroStatus = {
  connected: boolean;
  connectedAt?: string;
  tenants: Array<{ id: string; name: string }>;
};

type XeroErrorBody = {
  error?: string;
  expectedCallbackUri?: string;
  configuredRedirectUri?: string;
};

type LedgerSource = "manual" | "xero" | "bank_feed";

type MoneyGroup = {
  currency: string;
  amount: number;
  accountCount: number;
};

type SourceMoneyGroup = MoneyGroup & {
  source: LedgerSource;
};

type EntityMoneyGroup = MoneyGroup & {
  entityId: string;
  entityName: string;
};

type LedgerAccount = {
  id: string;
  entityId: string;
  accountName: string;
  currency: string | null;
  status: string;
  source: LedgerSource;
  latestBalance: {
    amount: number;
    currency: string;
    source: LedgerSource;
    balanceDate: string;
    asOf: string;
    balanceType: string;
  } | null;
};

type LedgerTransactionBreakdown = {
  currency: string;
  source: LedgerSource;
  inflow: number;
  outflow: number;
  net: number;
  transactionCount: number;
};

type LedgerRecentTransaction = {
  id: string;
  entityName: string;
  accountName: string;
  source: LedgerSource;
  transactionDate: string;
  description: string;
  signedAmount: number;
  direction: "inflow" | "outflow" | "unknown";
  currency: string;
  status: string;
};

type LedgerDashboardData = {
  asOf: string;
  windowDays: number;
  entities: Array<{ id: string; name: string; code: string | null; orgId: string }>;
  accounts: LedgerAccount[];
  totalsByCurrency: MoneyGroup[];
  totalsBySource: SourceMoneyGroup[];
  balancesByEntity: EntityMoneyGroup[];
  transactionBreakdowns: LedgerTransactionBreakdown[];
  recentTransactions: LedgerRecentTransaction[];
};

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function getXeroErrorMessage(body: XeroErrorBody, fallback: string) {
  const message = body.error || fallback;
  if (!body.expectedCallbackUri) return message;

  return `${message} Add ${body.expectedCallbackUri} in Xero, then set XERO_REDIRECT_URI to the same value in Vercel.`;
}

function xeroStatusMessage(status: string | null) {
  switch (status) {
    case "connected":
      return { tone: "success" as const, title: "Xero Connected", message: "Your Xero organisation is ready for future sync work." };
    case "denied":
      return { tone: "warning" as const, title: "Xero Connection Cancelled", message: "Xero did not grant access." };
    case "configuration_error":
      return { tone: "error" as const, title: "Xero Needs Configuration", message: "The deployment is missing required Xero or server Supabase env vars." };
    case "invalid_state":
    case "expired_state":
    case "invalid_callback":
      return { tone: "error" as const, title: "Xero Connection Expired", message: "Please start the Xero connection again." };
    case "connect_failed":
      return { tone: "error" as const, title: "Xero Connection Failed", message: "Xero returned to Lumen, but the token exchange or storage step failed." };
    default:
      return null;
  }
}

function sourceLabel(source: LedgerSource) {
  if (source === "xero") return "Xero";
  if (source === "bank_feed") return "Bank Feed";
  return "Manual";
}

function formatMoney(currency: string, amount: number) {
  const fractionDigits = Math.abs(amount) >= 1000 ? 0 : 2;
  return `${currency} ${new Intl.NumberFormat("en", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function StatSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <SkeletonBlock className="h-4 w-24" />
      <SkeletonBlock className="mt-4 h-8 w-32" />
      <SkeletonBlock className="mt-4 h-3 w-full" />
    </div>
  );
}

function CompactMoneyList({ rows, emptyLabel }: { rows: MoneyGroup[]; emptyLabel: string }) {
  if (!rows.length) return <div className="text-sm text-zinc-500">{emptyLabel}</div>;

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.currency} className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-medium text-zinc-700">{row.currency}</span>
          <span className="tabular-nums font-semibold text-zinc-950">{formatMoney(row.currency, row.amount)}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [xeroStatus, setXeroStatus] = useState<XeroStatus | null>(null);
  const [xeroLoading, setXeroLoading] = useState(false);
  const [xeroConnecting, setXeroConnecting] = useState(false);
  const [xeroError, setXeroError] = useState<string | null>(null);
  const [xeroNotice, setXeroNotice] = useState<ReturnType<typeof xeroStatusMessage>>(null);
  const [recoveringAccess, setRecoveringAccess] = useState(false);
  const [accessRecoveryNotice, setAccessRecoveryNotice] = useState<{ tone: "success" | "warning"; title: string; message: string } | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [ledgerData, setLedgerData] = useState<LedgerDashboardData | null>(null);

  const entityNameById = useMemo(() => new Map((ledgerData?.entities ?? []).map((entity) => [entity.id, entity.name])), [ledgerData]);
  const accountsWithBalances = ledgerData?.accounts.filter((account) => account.latestBalance) ?? [];

  const loadXeroStatus = useCallback(async (accessToken: string) => {
    setXeroLoading(true);
    setXeroError(null);
    try {
      const response = await fetch("/api/xero/status", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = (await response.json()) as XeroStatus | { error?: string };
      if (!response.ok) throw new Error("error" in body && body.error ? body.error : "Failed to load Xero status.");
      setXeroStatus(body as XeroStatus);
    } catch (e: unknown) {
      setXeroStatus(null);
      setXeroError(getErrorMessage(e, "Failed to load Xero status."));
    } finally {
      setXeroLoading(false);
    }
  }, []);

  const loadLedgerDashboard = useCallback(async (accessToken: string) => {
    setLedgerLoading(true);
    setLedgerError(null);
    try {
      const response = await fetch("/api/dashboard/ledger", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = (await response.json()) as LedgerDashboardData | { error?: string };
      if (!response.ok) throw new Error("error" in body && body.error ? body.error : "Failed to load ledger dashboard.");
      setLedgerData(body as LedgerDashboardData);
    } catch (e: unknown) {
      setLedgerData(null);
      setLedgerError(getErrorMessage(e, "Failed to load ledger dashboard."));
    } finally {
      setLedgerLoading(false);
    }
  }, []);

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

        const currentSession = {
          userId: data.session.user.id,
          email: data.session.user.email ?? null,
          accessToken: data.session.access_token,
        };
        setSession(currentSession);
        setXeroNotice(xeroStatusMessage(new URLSearchParams(window.location.search).get("xero")));
        void loadXeroStatus(currentSession.accessToken);
        void loadLedgerDashboard(currentSession.accessToken);

        const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
          if (!sess) {
            window.location.replace("/login");
            return;
          }
          const nextSession = { userId: sess.user.id, email: sess.user.email ?? null, accessToken: sess.access_token };
          setSession(nextSession);
          void loadXeroStatus(nextSession.accessToken);
          void loadLedgerDashboard(nextSession.accessToken);
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
  }, [loadLedgerDashboard, loadXeroStatus, supabase]);

  async function connectXero() {
    if (!session) return;
    setXeroConnecting(true);
    setXeroError(null);
    try {
      const response = await fetch("/api/xero/connect", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      const body = (await response.json()) as { authorizationUrl?: string } & XeroErrorBody;
      if (!response.ok || !body.authorizationUrl) throw new Error(getXeroErrorMessage(body, "Failed to start Xero connection."));
      window.location.assign(body.authorizationUrl);
    } catch (e: unknown) {
      setXeroError(getErrorMessage(e, "Failed to start Xero connection."));
      setXeroConnecting(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  async function recoverAccountAccess() {
    if (!session) return;
    setRecoveringAccess(true);
    setAccessRecoveryNotice(null);
    try {
      const response = await fetch("/api/account/recovery", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      const body = (await response.json()) as { error?: string; orgRole?: string; entityRole?: string };
      if (!response.ok) throw new Error(body.error || "Failed to recover account access.");
      setAccessRecoveryNotice({
        tone: "success",
        title: "Access Recovered",
        message: `Your Lumen workspace access is active as ${body.orgRole ?? "owner"} and entity ${body.entityRole ?? "admin"}.`,
      });
    } catch (e: unknown) {
      setAccessRecoveryNotice({
        tone: "warning",
        title: "Access Recovery Needs Admin",
        message: getErrorMessage(e, "Ask an existing owner to invite or promote this account."),
      });
    } finally {
      setRecoveringAccess(false);
    }
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
                <div className="text-xs font-semibold uppercase text-[#876b16]">Treasury Operations</div>
                <h1 className="mt-2 text-2xl font-semibold text-zinc-950">Bank Ledger Dashboard</h1>
                <div className="mt-3 min-h-6 text-sm leading-6 text-zinc-600">
                  Signed in as <span className="font-medium text-zinc-950">{session.email || session.userId}</span>
                  {ledgerData ? <span className="ml-2 text-zinc-500">Updated {formatDateTime(ledgerData.asOf)}</span> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void loadLedgerDashboard(session.accessToken)}
                  disabled={ledgerLoading}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                >
                  {ledgerLoading ? "Refreshing" : "Refresh"}
                </button>
                <Link
                  href="/dashboard/entities"
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
                >
                  Entities
                </Link>
                <Link
                  href="/dashboard/invoices"
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
                >
                  Statement Intake
                </Link>
              </div>
            </div>
          </section>

          {ledgerError ? (
            <Notice tone="error" title="Ledger Dashboard Unavailable">
              {ledgerError}
            </Notice>
          ) : null}

          <section className="grid gap-4 md:grid-cols-3">
            {ledgerLoading && !ledgerData ? (
              <>
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
              </>
            ) : (
              <>
                <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="text-sm font-medium text-zinc-600">Latest Bank Balances</div>
                  <div className="mt-4">
                    <CompactMoneyList rows={ledgerData?.totalsByCurrency ?? []} emptyLabel="No posted balances yet." />
                  </div>
                  <div className="mt-4 text-xs text-zinc-500">Currencies are shown separately.</div>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="text-sm font-medium text-zinc-600">Coverage</div>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-2xl font-semibold tabular-nums text-zinc-950">{ledgerData?.entities.length ?? 0}</div>
                      <div className="mt-1 text-xs text-zinc-500">Entities</div>
                    </div>
                    <div>
                      <div className="text-2xl font-semibold tabular-nums text-zinc-950">{ledgerData?.accounts.length ?? 0}</div>
                      <div className="mt-1 text-xs text-zinc-500">Accounts</div>
                    </div>
                    <div>
                      <div className="text-2xl font-semibold tabular-nums text-zinc-950">{accountsWithBalances.length}</div>
                      <div className="mt-1 text-xs text-zinc-500">Balanced</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="text-sm font-medium text-zinc-600">30-Day Movement</div>
                  <div className="mt-4 space-y-2">
                    {(ledgerData?.transactionBreakdowns ?? []).length ? (
                      ledgerData?.transactionBreakdowns.slice(0, 3).map((row) => (
                        <div key={`${row.source}:${row.currency}`} className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="font-medium text-zinc-700">
                            {sourceLabel(row.source)} {row.currency}
                          </span>
                          <span className="tabular-nums font-semibold text-zinc-950">{formatMoney(row.currency, row.net)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-zinc-500">No recent transactions.</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>

          {ledgerData && !ledgerData.entities.length ? (
            <Notice tone="info" title="No Entity Access">
              Create or request access to a Lumen entity before bank ledger balances can appear here.
            </Notice>
          ) : null}

          {ledgerData && ledgerData.entities.length > 0 && !ledgerData.accounts.length ? (
            <Notice tone="info" title="No Bank Accounts Yet">
              Add a manual statement account or sync Xero bank accounts from Statement Intake.
            </Notice>
          ) : null}

          <section className="grid gap-4 xl:grid-cols-[1.45fr_0.55fr]">
            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
                  <h2 className="text-sm font-semibold text-zinc-950">Account Balances</h2>
                  <div className="text-xs text-zinc-500">{accountsWithBalances.length} accounts with balances</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-100 text-sm">
                    <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-500">
                      <tr>
                        <th scope="col" className="px-5 py-3">Entity</th>
                        <th scope="col" className="px-5 py-3">Account</th>
                        <th scope="col" className="px-5 py-3">Source</th>
                        <th scope="col" className="px-5 py-3 text-right">Latest Balance</th>
                        <th scope="col" className="px-5 py-3">Balance Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {ledgerLoading && !ledgerData ? (
                        [0, 1, 2].map((item) => (
                          <tr key={item}>
                            <td className="px-5 py-4" colSpan={5}>
                              <SkeletonBlock className="h-4 w-full" />
                            </td>
                          </tr>
                        ))
                      ) : (ledgerData?.accounts ?? []).length ? (
                        ledgerData?.accounts.map((account) => (
                          <tr key={account.id} className="align-top">
                            <td className="px-5 py-4 font-medium text-zinc-950">{entityNameById.get(account.entityId) ?? "Unknown Entity"}</td>
                            <td className="px-5 py-4">
                              <div className="font-medium text-zinc-900">{account.accountName}</div>
                              <div className="mt-1 text-xs text-zinc-500">{account.currency ?? account.latestBalance?.currency ?? "Currency not set"}</div>
                            </td>
                            <td className="px-5 py-4 text-zinc-700">{sourceLabel(account.latestBalance?.source ?? account.source)}</td>
                            <td className="px-5 py-4 text-right tabular-nums font-semibold text-zinc-950">
                              {account.latestBalance ? formatMoney(account.latestBalance.currency, account.latestBalance.amount) : <span className="font-normal text-zinc-500">No balance</span>}
                            </td>
                            <td className="px-5 py-4 text-zinc-700">{account.latestBalance ? formatDate(account.latestBalance.balanceDate) : "Not available"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-5 py-8 text-center text-sm text-zinc-500" colSpan={5}>
                            No ledger accounts to show.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
                  <div className="border-b border-zinc-100 px-5 py-4">
                    <h2 className="text-sm font-semibold text-zinc-950">Balances by Entity</h2>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    {(ledgerData?.balancesByEntity ?? []).length ? (
                      ledgerData?.balancesByEntity.map((row) => (
                        <div key={`${row.entityId}:${row.currency}`} className="flex items-start justify-between gap-4 px-5 py-4 text-sm">
                          <div>
                            <div className="font-medium text-zinc-950">{row.entityName}</div>
                            <div className="mt-1 text-xs text-zinc-500">{row.accountCount} account{row.accountCount === 1 ? "" : "s"}</div>
                          </div>
                          <div className="text-right tabular-nums font-semibold text-zinc-950">{formatMoney(row.currency, row.amount)}</div>
                        </div>
                      ))
                    ) : (
                      <div className="px-5 py-8 text-sm text-zinc-500">No entity balance data yet.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
                  <div className="border-b border-zinc-100 px-5 py-4">
                    <h2 className="text-sm font-semibold text-zinc-950">Balances by Source</h2>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    {(ledgerData?.totalsBySource ?? []).length ? (
                      ledgerData?.totalsBySource.map((row) => (
                        <div key={`${row.source}:${row.currency}`} className="flex items-start justify-between gap-4 px-5 py-4 text-sm">
                          <div>
                            <div className="font-medium text-zinc-950">{sourceLabel(row.source)}</div>
                            <div className="mt-1 text-xs text-zinc-500">
                              {row.currency} across {row.accountCount} account{row.accountCount === 1 ? "" : "s"}
                            </div>
                          </div>
                          <div className="text-right tabular-nums font-semibold text-zinc-950">{formatMoney(row.currency, row.amount)}</div>
                        </div>
                      ))
                    ) : (
                      <div className="px-5 py-8 text-sm text-zinc-500">No source balance data yet.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
                <div className="border-b border-zinc-100 px-5 py-4">
                  <h2 className="text-sm font-semibold text-zinc-950">Recent Transaction Breakdown</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-100 text-sm">
                    <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-500">
                      <tr>
                        <th scope="col" className="px-5 py-3">Source</th>
                        <th scope="col" className="px-5 py-3">Currency</th>
                        <th scope="col" className="px-5 py-3 text-right">Inflow</th>
                        <th scope="col" className="px-5 py-3 text-right">Outflow</th>
                        <th scope="col" className="px-5 py-3 text-right">Net</th>
                        <th scope="col" className="px-5 py-3 text-right">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {(ledgerData?.transactionBreakdowns ?? []).length ? (
                        ledgerData?.transactionBreakdowns.map((row) => (
                          <tr key={`${row.source}:${row.currency}`}>
                            <td className="px-5 py-4 font-medium text-zinc-950">{sourceLabel(row.source)}</td>
                            <td className="px-5 py-4 text-zinc-700">{row.currency}</td>
                            <td className="px-5 py-4 text-right tabular-nums text-emerald-800">{formatMoney(row.currency, row.inflow)}</td>
                            <td className="px-5 py-4 text-right tabular-nums text-red-800">{formatMoney(row.currency, row.outflow)}</td>
                            <td className="px-5 py-4 text-right tabular-nums font-semibold text-zinc-950">{formatMoney(row.currency, row.net)}</td>
                            <td className="px-5 py-4 text-right tabular-nums text-zinc-700">{row.transactionCount}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-5 py-8 text-center text-sm text-zinc-500" colSpan={6}>
                            No transactions in the last {ledgerData?.windowDays ?? 30} days.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-950">Xero Connection</h2>
                    <div className="mt-2 text-sm leading-6 text-zinc-600">
                      {xeroLoading ? (
                        <Spinner label="Checking Xero" />
                      ) : xeroStatus?.connected ? (
                        <span className="font-medium text-emerald-800">Connected</span>
                      ) : (
                        "Not connected"
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={connectXero}
                    disabled={xeroConnecting || xeroLoading}
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-400"
                  >
                    {xeroConnecting ? "Opening Xero" : xeroStatus?.connected ? "Reconnect" : "Connect"}
                  </button>
                </div>

                {xeroNotice ? (
                  <div className="mt-4">
                    <Notice tone={xeroNotice.tone} title={xeroNotice.title}>
                      {xeroNotice.message}
                    </Notice>
                  </div>
                ) : null}

                {xeroError ? (
                  <div className="mt-4">
                    <Notice tone="warning" title="Xero Status Unavailable">
                      {xeroError}
                    </Notice>
                  </div>
                ) : null}

                {xeroStatus?.connected && xeroStatus.tenants.length ? (
                  <div className="mt-4 border-t border-zinc-100 pt-4">
                    <div className="text-xs font-semibold uppercase text-zinc-500">Tenants</div>
                    <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                      {xeroStatus.tenants.map((tenant) => (
                        <li key={tenant.id} className="truncate">
                          {tenant.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-950">Entity Setup</h2>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">Manage Lumen orgs, entities, and Xero tenant mapping for ledger sync.</p>
                  </div>
                  <Link
                    href="/dashboard/entities"
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
                  >
                    Manage
                  </Link>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-950">Recent Transactions</h2>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">Latest posted ledger rows from the last {ledgerData?.windowDays ?? 30} days.</p>
                  </div>
                </div>
                <div className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
                  {(ledgerData?.recentTransactions ?? []).length ? (
                    ledgerData?.recentTransactions.map((transaction) => (
                      <div key={transaction.id} className="py-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium text-zinc-950">{transaction.description || "Bank transaction"}</div>
                            <div className="mt-1 truncate text-xs text-zinc-500">
                              {transaction.entityName} - {transaction.accountName} - {sourceLabel(transaction.source)}
                            </div>
                          </div>
                          <div className={`shrink-0 tabular-nums font-semibold ${transaction.signedAmount < 0 ? "text-red-800" : "text-emerald-800"}`}>
                            {formatMoney(transaction.currency, transaction.signedAmount)}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">{formatDate(transaction.transactionDate)}</div>
                      </div>
                    ))
                  ) : (
                    <div className="py-4 text-sm text-zinc-500">No recent posted transactions.</div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-950">Account Recovery</h2>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">Repair default workspace access if your account exists but admin membership is missing.</p>
                  </div>
                  <button
                    type="button"
                    onClick={recoverAccountAccess}
                    disabled={recoveringAccess}
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                  >
                    {recoveringAccess ? "Recovering" : "Repair"}
                  </button>
                </div>
                {accessRecoveryNotice ? (
                  <div className="mt-4">
                    <Notice tone={accessRecoveryNotice.tone} title={accessRecoveryNotice.title}>
                      {accessRecoveryNotice.message}
                    </Notice>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
