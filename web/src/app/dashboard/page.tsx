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
type AccountType = "all" | "bank" | "money_processor";

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
  accountType: Exclude<AccountType, "all">;
  canAdmin: boolean;
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
  bankAccountId: string;
  entityName: string;
  accountName: string;
  source: LedgerSource;
  accountType: Exclude<AccountType, "all">;
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

type AccountUpdateResponse = {
  account?: {
    id: string;
    entityId: string;
    accountName: string;
    accountType: Exclude<AccountType, "all">;
  };
  error?: string;
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

function accountTypeLabel(accountType: AccountType) {
  if (accountType === "money_processor") return "Money Processor";
  if (accountType === "bank") return "Bank";
  return "All Accounts";
}

function accountTypePluralLabel(accountType: AccountType) {
  if (accountType === "money_processor") return "Money Processors";
  if (accountType === "bank") return "Banks";
  return "All Accounts";
}

function currencyLabel(currency: string) {
  return currency === "Unspecified" ? "Unspecified" : currency;
}

function formatMoney(currency: string, amount: number) {
  const fractionDigits = Math.abs(amount) >= 1000 ? 0 : 2;
  const formatted = new Intl.NumberFormat("en", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
  return currency === "Unspecified" ? formatted : `${currency} ${formatted}`;
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
          <span className="font-medium text-zinc-700">{currencyLabel(row.currency)}</span>
          <span className="tabular-nums font-semibold text-zinc-950">{formatMoney(row.currency, row.amount)}</span>
        </div>
      ))}
    </div>
  );
}

function groupBalances(accounts: LedgerAccount[]) {
  const groups = new Map<string, MoneyGroup>();
  for (const account of accounts) {
    if (!account.latestBalance) continue;
    const currency = account.latestBalance.currency;
    const existing = groups.get(currency) ?? { currency, amount: 0, accountCount: 0 };
    existing.amount += account.latestBalance.amount;
    existing.accountCount += 1;
    groups.set(currency, existing);
  }
  return Array.from(groups.values()).sort((left, right) => left.currency.localeCompare(right.currency));
}

function accountHasVisibleBalance(account: LedgerAccount, hideZeroBalances: boolean) {
  if (!hideZeroBalances) return true;
  return !account.latestBalance || account.latestBalance.amount !== 0;
}

function groupBalancesByEntity(accounts: LedgerAccount[], entityNameById: Map<string, string>) {
  const groups = new Map<string, EntityMoneyGroup>();
  for (const account of accounts) {
    if (!account.latestBalance) continue;
    const key = `${account.entityId}:${account.latestBalance.currency}`;
    const existing =
      groups.get(key) ??
      ({
        entityId: account.entityId,
        entityName: entityNameById.get(account.entityId) ?? "Unknown Entity",
        currency: account.latestBalance.currency,
        amount: 0,
        accountCount: 0,
      } satisfies EntityMoneyGroup);
    existing.amount += account.latestBalance.amount;
    existing.accountCount += 1;
    groups.set(key, existing);
  }
  return Array.from(groups.values()).sort((left, right) => left.entityName.localeCompare(right.entityName) || left.currency.localeCompare(right.currency));
}

function topAccounts(accounts: LedgerAccount[], entityNameById: Map<string, string>) {
  return accounts
    .filter((account) => account.latestBalance)
    .sort((left, right) => Math.abs(right.latestBalance?.amount ?? 0) - Math.abs(left.latestBalance?.amount ?? 0))
    .slice(0, 8)
    .map((account) => ({
      ...account,
      entityName: entityNameById.get(account.entityId) ?? "Unknown Entity",
    }));
}

function balanceShare(amount: number, total: number) {
  if (!total) return 0;
  return Math.max(3, Math.round((Math.abs(amount) / total) * 100));
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
  const [selectedAccountType, setSelectedAccountType] = useState<AccountType>("bank");
  const [hideZeroBalances, setHideZeroBalances] = useState(false);
  const [updatingAccountIds, setUpdatingAccountIds] = useState<Set<string>>(() => new Set());
  const [classificationNotice, setClassificationNotice] = useState<{ tone: "success" | "warning"; title: string; message: string } | null>(null);

  const entityNameById = useMemo(() => new Map((ledgerData?.entities ?? []).map((entity) => [entity.id, entity.name])), [ledgerData]);
  const accounts = useMemo(() => ledgerData?.accounts ?? [], [ledgerData]);
  const allVisibleAccounts = useMemo(() => accounts.filter((account) => accountHasVisibleBalance(account, hideZeroBalances)), [accounts, hideZeroBalances]);
  const accountTypeFilteredAccounts = useMemo(() => (selectedAccountType === "all" ? accounts : accounts.filter((account) => account.accountType === selectedAccountType)), [accounts, selectedAccountType]);
  const visibleAccounts = useMemo(() => accountTypeFilteredAccounts.filter((account) => accountHasVisibleBalance(account, hideZeroBalances)), [accountTypeFilteredAccounts, hideZeroBalances]);
  const accountsWithBalances = visibleAccounts.filter((account) => account.latestBalance);
  const filteredTotalsByCurrency = useMemo(() => groupBalances(visibleAccounts), [visibleAccounts]);
  const bankAccounts = useMemo(() => accounts.filter((account) => account.accountType === "bank"), [accounts]);
  const mpAccounts = useMemo(() => accounts.filter((account) => account.accountType === "money_processor"), [accounts]);
  const visibleBankAccounts = useMemo(() => bankAccounts.filter((account) => accountHasVisibleBalance(account, hideZeroBalances)), [bankAccounts, hideZeroBalances]);
  const visibleMpAccounts = useMemo(() => mpAccounts.filter((account) => accountHasVisibleBalance(account, hideZeroBalances)), [mpAccounts, hideZeroBalances]);
  const bankTotals = useMemo(() => groupBalances(visibleBankAccounts), [visibleBankAccounts]);
  const mpTotals = useMemo(() => groupBalances(visibleMpAccounts), [visibleMpAccounts]);
  const visibleTransactions = (ledgerData?.recentTransactions ?? []).filter((transaction) => {
    if (selectedAccountType === "all") return true;
    return transaction.accountType === selectedAccountType;
  }).slice(0, 10);
  const visibleTopAccounts = useMemo(() => topAccounts(visibleAccounts, entityNameById), [entityNameById, visibleAccounts]);
  const visibleBalancesByEntity = useMemo(() => groupBalancesByEntity(visibleAccounts, entityNameById), [entityNameById, visibleAccounts]);
  const currencyCount = new Set(filteredTotalsByCurrency.map((row) => row.currency)).size;
  const accountTypeOptions = [
    { type: "bank" as const, label: "Banks", accounts: visibleBankAccounts.length, rows: bankTotals },
    { type: "money_processor" as const, label: "Money Processors", accounts: visibleMpAccounts.length, rows: mpTotals },
    { type: "all" as const, label: "All Accounts", accounts: allVisibleAccounts.length, rows: groupBalances(allVisibleAccounts) },
  ];
  const accountTypeChartRows = [
    { label: "Banks", amount: bankTotals.reduce((total, row) => total + Math.abs(row.amount), 0), count: visibleBankAccounts.length },
    { label: "Money Processors", amount: mpTotals.reduce((total, row) => total + Math.abs(row.amount), 0), count: visibleMpAccounts.length },
  ];
  const accountTypeChartTotal = accountTypeChartRows.reduce((total, row) => total + row.amount, 0);

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

  async function updateAccountClassification(account: LedgerAccount, accountType: Exclude<AccountType, "all">) {
    if (!session || !account.canAdmin || account.accountType === accountType || updatingAccountIds.has(account.id)) return;

    setUpdatingAccountIds((current) => new Set(current).add(account.id));
    setClassificationNotice(null);
    try {
      const response = await fetch("/api/entity-bank-accounts", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entityId: account.entityId,
          accountId: account.id,
          accountType,
        }),
      });
      const body = (await response.json()) as AccountUpdateResponse;
      if (!response.ok || !body.account) throw new Error(body.error || "Failed to update account classification.");

      setLedgerData((current) => {
        if (!current) return current;
        return {
          ...current,
          accounts: current.accounts.map((item) => (item.id === body.account?.id ? { ...item, accountType: body.account.accountType } : item)),
          recentTransactions: current.recentTransactions.map((transaction) =>
            transaction.bankAccountId === body.account?.id ? { ...transaction, accountType: body.account.accountType } : transaction,
          ),
        };
      });
      setClassificationNotice({
        tone: "success",
        title: "Classification Updated",
        message: `${account.accountName} is now classified as ${accountTypeLabel(accountType)}.`,
      });
    } catch (e: unknown) {
      setClassificationNotice({
        tone: "warning",
        title: "Classification Not Saved",
        message: getErrorMessage(e, "Failed to update account classification."),
      });
    } finally {
      setUpdatingAccountIds((current) => {
        const next = new Set(current);
        next.delete(account.id);
        return next;
      });
    }
  }

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-[#f7f6f2] text-zinc-950">
        <div className="mx-auto min-w-0 max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
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
            <section className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
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
      <div className="mx-auto min-w-0 max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
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

        <main className="mt-7 space-y-5">
          <section className="border-b border-zinc-200 pb-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-zinc-500">Lumen Ledger</p>
                <h1 className="mt-2 text-2xl font-semibold text-zinc-950 sm:text-3xl">Ledger Operations</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">Monitor cash positions, processor balances, and recent statement activity across entities.</p>
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
                <Link href="/dashboard/entities" className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950">
                  Entities
                </Link>
                <Link href="/dashboard/invoices" className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950">
                  Statement Intake
                </Link>
                <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm">
                  <input
                    type="checkbox"
                    checked={hideZeroBalances}
                    onChange={(event) => setHideZeroBalances(event.target.checked)}
                    className="h-4 w-4 accent-zinc-950"
                  />
                  Hide zero balances
                </label>
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="grid gap-2 sm:grid-cols-3">
                {accountTypeOptions.map((option) => (
                  <button
                    key={option.type}
                    type="button"
                    onClick={() => setSelectedAccountType(option.type)}
                    className={`min-h-24 rounded-lg border px-4 py-3 text-left transition ${
                      selectedAccountType === option.type ? "border-zinc-950 bg-white shadow-sm" : "border-zinc-200 bg-white/70 hover:border-zinc-300 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-zinc-950">{option.label}</span>
                      <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">{option.accounts}</span>
                    </div>
                    <div className="mt-3">
                      <CompactMoneyList rows={option.rows.slice(0, 2)} emptyLabel="No balances" />
                    </div>
                  </button>
                ))}
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white/70 px-4 py-3 text-sm text-zinc-600">
                <div className="text-xs font-semibold uppercase text-zinc-500">Updated</div>
                <div className="mt-1 whitespace-nowrap font-medium text-zinc-900">{ledgerData ? formatDateTime(ledgerData.asOf) : "Loading"}</div>
              </div>
            </div>
          </section>

          {ledgerError ? (
            <Notice tone="error" title="Ledger Dashboard Unavailable">
              {ledgerError}
            </Notice>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {ledgerLoading && !ledgerData ? (
              <>
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
              </>
            ) : (
              <>
                <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase text-zinc-500">Total Balance</div>
                  <div className="mt-2 text-xl font-semibold tabular-nums text-zinc-950">
                    {filteredTotalsByCurrency.length === 1 ? formatMoney(filteredTotalsByCurrency[0].currency, filteredTotalsByCurrency[0].amount) : `${filteredTotalsByCurrency.length} currency totals`}
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase text-zinc-500">All Currencies</div>
                  <div className="mt-2 text-xl font-semibold tabular-nums text-zinc-950">{currencyCount}</div>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase text-zinc-500">Accounts</div>
                  <div className="mt-2 text-xl font-semibold tabular-nums text-zinc-950">{visibleAccounts.length}</div>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase text-zinc-500">With Balances</div>
                  <div className="mt-2 text-xl font-semibold tabular-nums text-zinc-950">{accountsWithBalances.length}</div>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase text-zinc-500">Entities</div>
                  <div className="mt-2 text-xl font-semibold tabular-nums text-zinc-950">{ledgerData?.entities.length ?? 0}</div>
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
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
                  <div className="border-b border-zinc-100 px-5 py-3">
                    <h2 className="text-sm font-semibold text-zinc-950">Account Type Totals</h2>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    {[
                      { type: "bank" as const, rows: bankTotals, accounts: visibleBankAccounts.length },
                      { type: "money_processor" as const, rows: mpTotals, accounts: visibleMpAccounts.length },
                    ].map((row) => (
                      <button
                        key={row.type}
                        type="button"
                        onClick={() => setSelectedAccountType(row.type)}
                        className={`flex w-full items-start justify-between gap-4 px-5 py-4 text-left text-sm transition hover:bg-zinc-50 ${selectedAccountType === row.type ? "bg-zinc-50" : ""}`}
                      >
                        <div>
                          <div className="font-medium text-zinc-950">{accountTypePluralLabel(row.type)}</div>
                          <div className="mt-1 text-xs text-zinc-500">{row.accounts} account{row.accounts === 1 ? "" : "s"}</div>
                        </div>
                        <div className="min-w-32 text-right">
                          <CompactMoneyList rows={row.rows} emptyLabel="No balances" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
                  <div className="border-b border-zinc-100 px-5 py-3">
                    <h2 className="text-sm font-semibold text-zinc-950">Entity Balances</h2>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    {visibleBalancesByEntity.length ? (
                      visibleBalancesByEntity.slice(0, 7).map((row) => (
                        <div key={`${row.entityId}:${row.currency}`} className="flex items-start justify-between gap-4 px-5 py-3 text-sm">
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
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-950">{accountTypePluralLabel(selectedAccountType)} Drilldown</h2>
                    <div className="mt-1 text-xs text-zinc-500">
                      {hideZeroBalances ? "Zero-balance accounts hidden; totals shown are unchanged by hidden zeroes." : "Showing all ledger accounts for this view."}
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500">{accountsWithBalances.length} accounts with balances</div>
                </div>
                {classificationNotice ? (
                  <div className="border-b border-zinc-100 px-5 py-3">
                    <Notice tone={classificationNotice.tone} title={classificationNotice.title}>
                      {classificationNotice.message}
                    </Notice>
                  </div>
                ) : null}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-100 text-sm">
                    <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-500">
                      <tr>
                        <th scope="col" className="px-5 py-3">Entity</th>
                        <th scope="col" className="px-5 py-3">Account</th>
                        <th scope="col" className="px-5 py-3">Type</th>
                        <th scope="col" className="px-5 py-3">Source</th>
                        <th scope="col" className="px-5 py-3 text-right">Latest Balance</th>
                        <th scope="col" className="px-5 py-3">Balance Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {ledgerLoading && !ledgerData ? (
                        [0, 1, 2].map((item) => (
                          <tr key={item}>
                            <td className="px-5 py-4" colSpan={6}>
                              <SkeletonBlock className="h-4 w-full" />
                            </td>
                          </tr>
                        ))
                      ) : visibleAccounts.length ? (
                        visibleAccounts.map((account) => (
                          <tr key={account.id} className="align-top">
                            <td className="px-5 py-4 font-medium text-zinc-950">{entityNameById.get(account.entityId) ?? "Unknown Entity"}</td>
                            <td className="px-5 py-4">
                              <div className="font-medium text-zinc-900">{account.accountName}</div>
                              <div className="mt-1 text-xs text-zinc-500">{currencyLabel(account.currency ?? account.latestBalance?.currency ?? "Unspecified")}</div>
                            </td>
                            <td className="px-5 py-4">
                              <label className="sr-only" htmlFor={`account-type-${account.id}`}>
                                Classification for {account.accountName}
                              </label>
                              <select
                                id={`account-type-${account.id}`}
                                value={account.accountType}
                                onChange={(event) => void updateAccountClassification(account, event.target.value as Exclude<AccountType, "all">)}
                                disabled={!account.canAdmin || updatingAccountIds.has(account.id)}
                                title={account.canAdmin ? "Update account classification" : "Manage account classification from Entity Setup"}
                                className="h-9 min-w-36 rounded-md border border-zinc-300 bg-white px-2 text-sm font-medium text-zinc-800 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                              >
                                <option value="bank">Bank</option>
                                <option value="money_processor">Money Processor</option>
                              </select>
                              {!account.canAdmin ? <div className="mt-1 text-xs text-zinc-500">Admin only</div> : null}
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
                          <td className="px-5 py-8 text-center text-sm text-zinc-500" colSpan={6}>
                            No ledger accounts to show.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
                <div className="border-b border-zinc-100 px-5 py-4">
                  <h2 className="text-sm font-semibold text-zinc-950">Top Accounts by Balance</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-100 text-sm">
                    <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-500">
                      <tr>
                        <th scope="col" className="px-5 py-3">Account</th>
                        <th scope="col" className="px-5 py-3">Entity</th>
                        <th scope="col" className="px-5 py-3">Source</th>
                        <th scope="col" className="px-5 py-3 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {visibleTopAccounts.length ? (
                        visibleTopAccounts.map((account) => (
                          <tr key={account.id}>
                            <td className="px-5 py-4 font-medium text-zinc-950">{account.accountName}</td>
                            <td className="px-5 py-4 text-zinc-700">{account.entityName}</td>
                            <td className="px-5 py-4 text-zinc-700">{sourceLabel(account.latestBalance?.source ?? account.source)}</td>
                            <td className="px-5 py-4 text-right tabular-nums font-semibold text-zinc-950">{account.latestBalance ? formatMoney(account.latestBalance.currency, account.latestBalance.amount) : "No balance"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-5 py-8 text-center text-sm text-zinc-500" colSpan={4}>
                            No ranked accounts for this view.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
                <div className="border-b border-zinc-100 px-5 py-3">
                  <h2 className="text-sm font-semibold text-zinc-950">Account Mix</h2>
                </div>
                <div className="space-y-5 p-5">
                  <div>
                    <div className="text-sm font-semibold text-zinc-950">Balance by Account Type</div>
                    <div className="mt-4 space-y-3">
                      {accountTypeChartRows.map((row) => (
                        <div key={row.label}>
                          <div className="flex items-center justify-between gap-3 text-xs text-zinc-600">
                            <span>{row.label}</span>
                            <span>{row.count} account{row.count === 1 ? "" : "s"}</span>
                          </div>
                          <div className="mt-1 h-3 overflow-hidden rounded-full bg-zinc-100">
                            <div className={`h-full rounded-full ${row.label === "Banks" ? "bg-sky-700" : "bg-emerald-700"}`} style={{ width: `${balanceShare(row.amount, accountTypeChartTotal)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-zinc-950">Currency Totals</div>
                    <div className="mt-3">
                      <CompactMoneyList rows={filteredTotalsByCurrency} emptyLabel="No balances in this view." />
                    </div>
                  </div>
                </div>
              </div>

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
                  {visibleTransactions.length ? (
                    visibleTransactions.map((transaction) => (
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
