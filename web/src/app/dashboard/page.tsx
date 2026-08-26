"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { Notice, SkeletonBlock, Spinner } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type SessionInfo = {
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
};

type LedgerSource = "manual" | "xero" | "bank_feed";
type AccountType = "operating_bank" | "client_money" | "money_processor" | "liquidity_provider";

type LedgerAccount = {
  id: string;
  entityId: string;
  accountName: string;
  currency: string | null;
  status: string;
  source: LedgerSource;
  accountType: AccountType;
  canAdmin: boolean;
  latestBalance: {
    amount: number;
    currency: string;
    originalCurrency: string;
    source: LedgerSource;
    balanceDate: string;
    asOf: string;
    balanceType: string;
    usdConversion: {
      amount: number;
      rate: number;
      rateDate: string;
      asOf: string;
      source: string;
    } | null;
  } | null;
};

type LedgerRecentTransaction = {
  id: string;
  bankAccountId: string;
  entityName: string;
  accountName: string;
  source: LedgerSource;
  accountType: AccountType;
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
  totalsByAccountType: Array<{ accountType: AccountType; currency: string; amount: number; accountCount: number }>;
  recentTransactions: LedgerRecentTransaction[];
  dataQualityIssues: Array<{
    code: "invalid_balance_currency" | "missing_usd_rate";
    severity: "warning";
    message: string;
    entityId: string;
    bankAccountId: string;
    balanceId?: string;
    currency: string;
  }>;
  fx: {
    enabled: boolean;
    status: "available" | "missing_credentials" | "schema_missing" | "fetch_failed";
    source: "frankfurter" | "xe";
    missingCurrencies: string[];
  };
};

type ExposureRow = {
  id: string;
  label: string;
  detail: string;
  amountUsd: number;
  accountCount: number;
};

type ActionItem = {
  id: string;
  title: string;
  detail: string;
  tone: "warning" | "info";
};

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function getXeroErrorMessage(body: XeroErrorBody, fallback: string) {
  const message = body.error || fallback;
  if (!body.expectedCallbackUri) return message;
  return `${message} Add ${body.expectedCallbackUri} in Xero, then update the matching redirect URI in deployment settings.`;
}

function xeroStatusMessage(status: string | null) {
  switch (status) {
    case "connected":
      return { tone: "success" as const, title: "Connection Ready", message: "The ledger connection is ready for balance sync." };
    case "denied":
      return { tone: "warning" as const, title: "Connection Cancelled", message: "Access was not granted. Start the connection again when ready." };
    case "configuration_error":
      return { tone: "error" as const, title: "Connection Needs Configuration", message: "Required integration or server settings are missing." };
    case "invalid_state":
    case "expired_state":
    case "invalid_callback":
      return { tone: "error" as const, title: "Connection Expired", message: "Start the connection again to refresh authorization." };
    case "connect_failed":
      return { tone: "error" as const, title: "Connection Failed", message: "Authorization returned, but token storage did not complete." };
    default:
      return null;
  }
}

function sourceLabel(source: LedgerSource) {
  if (source === "xero") return "Xero";
  if (source === "bank_feed") return "Bank Feed";
  return "Manual";
}

function accountTypeLabel(accountType: AccountType) {
  if (accountType === "client_money") return "Client money accounts";
  if (accountType === "money_processor") return "Money processors";
  if (accountType === "liquidity_provider") return "Liquidity providers";
  return "Operating bank accounts";
}

function formatMoney(currency: string, amount: number, compact = false) {
  return new Intl.NumberFormat("en", {
    style: currency === "USD" ? "currency" : "decimal",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(amount);
}

function formatLocalMoney(currency: string, amount: number) {
  const formatted = new Intl.NumberFormat("en", {
    minimumFractionDigits: Math.abs(amount) >= 1000 ? 0 : 2,
    maximumFractionDigits: Math.abs(amount) >= 1000 ? 0 : 2,
  }).format(amount);
  return `${currency || "Unspecified"} ${formatted}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

function balanceUsd(account: LedgerAccount) {
  if (!account.latestBalance) return null;
  if (account.latestBalance.usdConversion) return account.latestBalance.usdConversion.amount;
  return account.latestBalance.currency === "USD" ? account.latestBalance.amount : null;
}

function latestIso(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).sort((left, right) => right.localeCompare(left))[0] ?? null;
}

function groupExposure(accounts: LedgerAccount[], entityNameById: Map<string, string>, groupBy: "entity" | "account" | "accountType"): ExposureRow[] {
  const groups = new Map<string, ExposureRow>();

  for (const account of accounts) {
    const amountUsd = balanceUsd(account);
    if (amountUsd === null) continue;

    const key = groupBy === "entity" ? account.entityId : groupBy === "accountType" ? account.accountType : account.accountName;
    const current =
      groups.get(key) ??
      ({
        id: key,
        label:
          groupBy === "entity"
            ? entityNameById.get(account.entityId) ?? "Unassigned Entity"
            : groupBy === "accountType"
              ? accountTypeLabel(account.accountType)
              : account.accountName,
        detail:
          groupBy === "entity"
            ? "Converted account balances"
            : groupBy === "accountType"
              ? "Converted balances by treasury category"
              : `${entityNameById.get(account.entityId) ?? "Unassigned Entity"} · ${accountTypeLabel(account.accountType)}`,
        amountUsd: 0,
        accountCount: 0,
      } satisfies ExposureRow);
    current.amountUsd += amountUsd;
    current.accountCount += 1;
    groups.set(key, current);
  }

  return Array.from(groups.values()).sort((left, right) => Math.abs(right.amountUsd) - Math.abs(left.amountUsd));
}

function rowsWithRemaining(rows: ExposureRow[], maxRows = 6) {
  if (rows.length <= maxRows) return rows;

  const visibleRows = rows.slice(0, maxRows - 1);
  const remainingRows = rows.slice(maxRows - 1);
  const relationshipLabel = remainingRows.length === 1 ? "relationship" : "relationships";
  visibleRows.push({
    id: "__remaining",
    label: "Other/remaining",
    detail: `${remainingRows.length} ${relationshipLabel} represented`,
    amountUsd: remainingRows.reduce((total, row) => total + row.amountUsd, 0),
    accountCount: remainingRows.reduce((total, row) => total + row.accountCount, 0),
  });
  return visibleRows;
}

function concentrationTone(share: number) {
  if (share >= 0.35) return "High";
  if (share >= 0.2) return "Elevated";
  return "Balanced";
}

function buildActionItems(data: LedgerDashboardData | null, xeroStatus: XeroStatus | null): ActionItem[] {
  if (!data) return [];

  const missingFxAccounts = data.accounts.filter((account) => account.latestBalance && balanceUsd(account) === null);
  const missingBalanceAccounts = data.accounts.filter((account) => !account.latestBalance);
  const inactiveAccounts = data.accounts.filter((account) => account.status !== "active");
  const items: ActionItem[] = [];

  if (missingFxAccounts.length) {
    const currencies = Array.from(new Set(missingFxAccounts.map((account) => account.latestBalance?.currency ?? account.currency ?? "Unspecified"))).join(", ");
    items.push({
      id: "missing-fx",
      title: "Add exchange rates",
      detail: `${missingFxAccounts.length} account${missingFxAccounts.length === 1 ? "" : "s"} excluded from USD liquidity because ${currencies} conversion is unavailable.`,
      tone: "warning",
    });
  }

  if (missingBalanceAccounts.length) {
    items.push({
      id: "missing-balances",
      title: "Sync account balances",
      detail: `${missingBalanceAccounts.length} account${missingBalanceAccounts.length === 1 ? "" : "s"} have no latest balance yet.`,
      tone: "info",
    });
  }

  if (inactiveAccounts.length) {
    items.push({
      id: "inactive-accounts",
      title: "Review inactive accounts",
      detail: `${inactiveAccounts.length} inactive account${inactiveAccounts.length === 1 ? "" : "s"} remain in the ledger feed.`,
      tone: "info",
    });
  }

  if (!xeroStatus?.connected) {
    items.push({
      id: "connection",
      title: "Connect a ledger source",
      detail: "Connect an accounting source or continue with manual statement uploads to keep balances fresh.",
      tone: "info",
    });
  }

  return items.slice(0, 4);
}

function StatSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <SkeletonBlock className="h-4 w-24" />
      <SkeletonBlock className="mt-4 h-8 w-32" />
      <SkeletonBlock className="mt-4 h-3 w-full" />
    </div>
  );
}

function KpiCard({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "warning" | "success" }) {
  const toneClass = tone === "warning" ? "text-amber-800" : tone === "success" ? "text-emerald-800" : "text-zinc-950";

  return (
    <div className="h-full min-w-0 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase text-zinc-500">{label}</div>
      <div className={`mt-2 break-words text-xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      <div className="mt-2 text-xs leading-5 text-zinc-500">{detail}</div>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-zinc-950">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs leading-5 text-zinc-500">{subtitle}</p> : null}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function ExposureList({ rows, totalUsd, emptyLabel, maxRows }: { rows: ExposureRow[]; totalUsd: number; emptyLabel: string; maxRows?: number }) {
  if (!rows.length) return <div className="text-sm text-zinc-500">{emptyLabel}</div>;

  const displayedRows = maxRows ? rowsWithRemaining(rows, maxRows) : rows;

  return (
    <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
      {displayedRows.map((row) => {
        const share = totalUsd ? Math.abs(row.amountUsd / totalUsd) : 0;
        return (
          <div key={row.id}>
            <div className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium text-zinc-950">{row.label}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {row.detail} · {row.accountCount} account{row.accountCount === 1 ? "" : "s"}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="tabular-nums font-semibold text-zinc-950">{formatMoney("USD", row.amountUsd, true)}</div>
                <div className="mt-1 text-xs text-zinc-500">{formatPercent(share)}</div>
              </div>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-sky-700" style={{ width: `${Math.max(3, Math.min(100, share * 100))}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [ledgerData, setLedgerData] = useState<LedgerDashboardData | null>(null);
  const [xeroStatus, setXeroStatus] = useState<XeroStatus | null>(null);
  const [xeroLoading, setXeroLoading] = useState(false);
  const [xeroConnecting, setXeroConnecting] = useState(false);
  const [xeroError, setXeroError] = useState<string | null>(null);
  const [xeroNotice, setXeroNotice] = useState<ReturnType<typeof xeroStatusMessage>>(null);

  const entityNameById = useMemo(() => new Map((ledgerData?.entities ?? []).map((entity) => [entity.id, entity.name])), [ledgerData]);
  const accounts = useMemo(() => ledgerData?.accounts ?? [], [ledgerData]);
  const accountsWithBalances = accounts.filter((account) => account.latestBalance);
  const convertedAccounts = accountsWithBalances.filter((account) => balanceUsd(account) !== null);
  const missingFxAccounts = accountsWithBalances.length - convertedAccounts.length;
  const totalUsd = convertedAccounts.reduce((total, account) => total + (balanceUsd(account) ?? 0), 0);
  const latestBalanceDate = latestIso(accountsWithBalances.map((account) => account.latestBalance?.balanceDate));
  const latestRefresh = latestIso(accountsWithBalances.map((account) => account.latestBalance?.asOf)) ?? ledgerData?.asOf ?? null;
  const entityExposure = useMemo(() => groupExposure(accounts, entityNameById, "entity"), [accounts, entityNameById]);
  const accountExposure = useMemo(() => groupExposure(accounts, entityNameById, "account"), [accounts, entityNameById]);
  const categoryExposure = useMemo(() => groupExposure(accounts, entityNameById, "accountType"), [accounts, entityNameById]);
  const topExposure = accountExposure[0] ?? null;
  const topShare = topExposure && totalUsd ? Math.abs(topExposure.amountUsd / totalUsd) : 0;
  const actionItems = useMemo(() => buildActionItems(ledgerData, xeroStatus), [ledgerData, xeroStatus]);
  const recentTransactions = (ledgerData?.recentTransactions ?? []).slice(0, 6);

  const loadXeroStatus = useCallback(async (accessToken: string) => {
    setXeroLoading(true);
    setXeroError(null);
    try {
      const response = await fetch("/api/xero/status", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = (await response.json()) as XeroStatus | { error?: string };
      if (!response.ok) throw new Error("error" in body && body.error ? body.error : "Failed to load connection status.");
      setXeroStatus(body as XeroStatus);
    } catch (err: unknown) {
      setXeroStatus(null);
      setXeroError(getErrorMessage(err, "Failed to load connection status."));
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
    } catch (err: unknown) {
      setLedgerData(null);
      setLedgerError(getErrorMessage(err, "Failed to load ledger dashboard."));
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
          const nextSession = { accessToken: sess.access_token };
          setSession(nextSession);
          void loadXeroStatus(nextSession.accessToken);
          void loadLedgerDashboard(nextSession.accessToken);
        });
        unsub = sub.subscription;
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Failed to load your session."));
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
      if (!response.ok || !body.authorizationUrl) throw new Error(getXeroErrorMessage(body, "Failed to start ledger connection."));
      window.location.assign(body.authorizationUrl);
    } catch (err: unknown) {
      setXeroError(getErrorMessage(err, "Failed to start ledger connection."));
      setXeroConnecting(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-[#f7f6f2] text-zinc-950">
        <div className="mx-auto min-w-0 max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex min-h-11 items-center gap-4">
            <Link href="/" className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-950">
              <BrandLogo className="h-8 sm:h-9" />
            </Link>
            <div className="h-6 w-px bg-zinc-300" aria-hidden="true" />
            <div className="text-sm font-medium text-zinc-700">Treasury Dashboard</div>
          </header>

          <main className="mt-8">
            {error ? (
              <Notice tone="error" title="Authentication Needs Configuration">
                {error}
              </Notice>
            ) : (
              <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                <Spinner label="Checking session" />
              </section>
            )}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-zinc-950">
      <div className="mx-auto min-w-0 max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex min-h-11 flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/" className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-950">
              <BrandLogo className="h-8 sm:h-9" />
            </Link>
            <div className="h-6 w-px bg-zinc-300" aria-hidden="true" />
            <div className="text-sm font-medium text-zinc-700">Treasury Dashboard</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/entities" className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 sm:px-4">
              Entities
            </Link>
            <Link href="/dashboard/invoices" className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-950 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 sm:px-4">
              Statement Intake
            </Link>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut || !supabase}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 sm:px-4"
            >
              {signingOut ? "Signing Out" : "Sign Out"}
            </button>
          </div>
        </header>

        <main className="mt-7 space-y-5">
          <section className="border-b border-zinc-200 pb-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-zinc-500">Treasury Workspace</p>
                <h1 className="mt-2 break-words text-2xl font-semibold text-zinc-950 sm:text-3xl">Treasury Dashboard</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                  Monitor operating cash, client money, processor balances, liquidity-provider balances, and recent ledger movement from authenticated treasury data.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void loadLedgerDashboard(session.accessToken);
                    void loadXeroStatus(session.accessToken);
                  }}
                  disabled={ledgerLoading || xeroLoading}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                >
                  {ledgerLoading || xeroLoading ? "Refreshing" : "Refresh"}
                </button>
                <button
                  type="button"
                  onClick={connectXero}
                  disabled={xeroConnecting || xeroLoading}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-400"
                >
                  {xeroConnecting ? "Opening" : xeroStatus?.connected ? "Reconnect Source" : "Connect Source"}
                </button>
              </div>
            </div>
          </section>

          {xeroNotice ? (
            <Notice tone={xeroNotice.tone} title={xeroNotice.title}>
              {xeroNotice.message}
            </Notice>
          ) : null}

          {xeroError ? (
            <Notice tone="warning" title="Connection Status Unavailable">
              {xeroError}
            </Notice>
          ) : null}

          {ledgerError ? (
            <Notice tone="error" title="Treasury Dashboard Unavailable">
              {ledgerError}
            </Notice>
          ) : null}

          {missingFxAccounts ? (
            <Notice tone="warning" title="Missing FX Conversion">
              {missingFxAccounts} account{missingFxAccounts === 1 ? "" : "s"} have balances without USD conversion and are excluded from converted liquidity.
            </Notice>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ledgerLoading && !ledgerData ? (
              <>
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
              </>
            ) : (
              <>
                <KpiCard
                  label="Converted Liquidity"
                  value={convertedAccounts.length ? formatMoney("USD", totalUsd) : "Unavailable"}
                  detail={`${convertedAccounts.length}/${accountsWithBalances.length} account balances included`}
                  tone={convertedAccounts.length ? "success" : "warning"}
                />
                <KpiCard
                  label="Coverage"
                  value={accounts.length ? `${accountsWithBalances.length}/${accounts.length}` : "No accounts"}
                  detail={latestBalanceDate ? `Latest balance date ${formatDate(latestBalanceDate)}` : "Waiting for first balance sync"}
                />
                <KpiCard
                  label="Concentration"
                  value={topExposure ? concentrationTone(topShare) : "Unavailable"}
                  detail={topExposure ? `${topExposure.label} holds ${formatPercent(topShare)} of converted liquidity` : "No converted balances yet"}
                  tone={topShare >= 0.35 ? "warning" : "neutral"}
                />
                <KpiCard
                  label="Data Freshness"
                  value={latestRefresh ? formatDateTime(latestRefresh) : "Not synced"}
                  detail={ledgerData ? `Source connection ${xeroStatus?.connected ? "ready" : "needs review"}` : "Loading finance data"}
                />
              </>
            )}
          </section>

          {ledgerData?.dataQualityIssues.length ? (
            <Notice tone="warning" title="Data Quality Review">
              {ledgerData.dataQualityIssues.slice(0, 2).map((issue) => issue.message).join(" ")}
              {ledgerData.dataQualityIssues.length > 2 ? ` ${ledgerData.dataQualityIssues.length - 2} more issue${ledgerData.dataQualityIssues.length - 2 === 1 ? "" : "s"} need review.` : ""}
            </Notice>
          ) : null}

          {ledgerData && !ledgerData.entities.length ? (
            <Notice tone="info" title="No Entity Access">
              Create or request access to an entity before ledger balances can appear here.
            </Notice>
          ) : null}

          {ledgerData && ledgerData.entities.length > 0 && !ledgerData.accounts.length ? (
            <Notice tone="info" title="No Accounts Yet">
              Add a statement account or connect an accounting source to start building treasury visibility.
            </Notice>
          ) : null}

          <section className="grid gap-4 xl:grid-cols-3">
            <Panel title="Treasury Categories" subtitle="Converted balances across operating accounts, client money, processors, and liquidity providers.">
              <ExposureList rows={categoryExposure} totalUsd={totalUsd} emptyLabel="No converted category balances yet." />
            </Panel>

            <Panel title="Liquidity by Entity" subtitle="Converted balances grouped by entity, limited to accounts with available USD conversion.">
              <ExposureList rows={entityExposure} totalUsd={totalUsd} emptyLabel="No converted entity balances yet." />
            </Panel>

            <Panel title="Exposure by Account" subtitle="Largest account relationships by converted balance.">
              <ExposureList rows={accountExposure} totalUsd={totalUsd} emptyLabel="No converted account balances yet." maxRows={6} />
            </Panel>
          </section>

          <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <Panel title="Action Needs" subtitle="Items that affect liquidity confidence or dashboard completeness.">
              {actionItems.length ? (
                <div className="space-y-3">
                  {actionItems.map((item) => (
                    <Notice key={item.id} tone={item.tone} title={item.title}>
                      {item.detail}
                    </Notice>
                  ))}
                </div>
              ) : (
                <Notice tone="success" title="No Immediate Actions">
                  Converted balances are available and no account-level data issues are currently reported.
                </Notice>
              )}
            </Panel>

            <Panel title="Recent Movements" subtitle={`Latest posted ledger activity from the past ${ledgerData?.windowDays ?? 30} days when available.`}>
              <div className="overflow-x-auto">
                <table className="min-w-[560px] divide-y divide-zinc-100 text-sm sm:min-w-full">
                  <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-500">
                    <tr>
                      <th scope="col" className="px-3 py-2">Date</th>
                      <th scope="col" className="px-3 py-2">Account</th>
                      <th scope="col" className="px-3 py-2">Description</th>
                      <th scope="col" className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {recentTransactions.length ? (
                      recentTransactions.map((transaction) => (
                        <tr key={transaction.id} className="align-top">
                          <td className="whitespace-nowrap px-3 py-3 text-zinc-700">{formatDate(transaction.transactionDate)}</td>
                          <td className="max-w-44 px-3 py-3">
                            <div className="truncate font-medium text-zinc-950">{transaction.accountName}</div>
                            <div className="mt-1 truncate text-xs text-zinc-500">{transaction.entityName} · {sourceLabel(transaction.source)}</div>
                          </td>
                          <td className="max-w-64 px-3 py-3 text-zinc-700">{transaction.description || "No description"}</td>
                          <td className={`whitespace-nowrap px-3 py-3 text-right tabular-nums font-semibold ${transaction.signedAmount < 0 ? "text-red-800" : transaction.signedAmount > 0 ? "text-emerald-800" : "text-zinc-950"}`}>
                            {formatLocalMoney(transaction.currency, transaction.signedAmount)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-3 py-8 text-center text-sm text-zinc-500" colSpan={4}>
                          No recent ledger movements are available yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </section>

          <Panel title="Account Detail" subtitle="Latest balances with local amounts, converted USD, source, and account status.">
            <div className="overflow-x-auto">
              <table className="min-w-[860px] divide-y divide-zinc-100 text-sm">
                <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">Entity</th>
                    <th scope="col" className="px-4 py-3">Account</th>
                    <th scope="col" className="px-4 py-3">Type</th>
                    <th scope="col" className="px-4 py-3">Source</th>
                    <th scope="col" className="px-4 py-3 text-right">Local Balance</th>
                    <th scope="col" className="px-4 py-3 text-right">USD Balance</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {ledgerLoading && !ledgerData ? (
                    [0, 1, 2].map((item) => (
                      <tr key={item}>
                        <td className="px-4 py-4" colSpan={7}>
                          <SkeletonBlock className="h-4 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : accounts.length ? (
                    accounts.map((account) => {
                      const usdAmount = balanceUsd(account);
                      return (
                        <tr key={account.id} className="align-top">
                          <td className="px-4 py-3 font-medium text-zinc-950">{entityNameById.get(account.entityId) ?? "Unassigned Entity"}</td>
                          <td className="max-w-64 px-4 py-3">
                            <div className="truncate font-medium text-zinc-900">{account.accountName}</div>
                            <div className="mt-1 text-xs text-zinc-500">{account.latestBalance ? formatDate(account.latestBalance.balanceDate) : "No balance date"}</div>
                          </td>
                          <td className="px-4 py-3 text-zinc-700">{accountTypeLabel(account.accountType)}</td>
                          <td className="px-4 py-3 text-zinc-700">{sourceLabel(account.latestBalance?.source ?? account.source)}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-zinc-950">
                            {account.latestBalance ? formatLocalMoney(account.latestBalance.currency, account.latestBalance.amount) : <span className="font-normal text-zinc-500">No balance</span>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-zinc-950">
                            {usdAmount !== null ? formatMoney("USD", usdAmount) : <span className="font-normal text-zinc-500">Missing rate</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-md px-2 py-1 text-xs font-medium ${account.status === "active" ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-600"}`}>
                              {account.status === "active" ? "Active" : "Review"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="px-4 py-8 text-center text-sm text-zinc-500" colSpan={7}>
                        No ledger accounts are available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </main>
      </div>
    </div>
  );
}
