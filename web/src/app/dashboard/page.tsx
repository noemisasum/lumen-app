"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { Notice, SkeletonBlock, Spinner } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { estimateInternalTransferEliminations } from "@/lib/treasury-movement";

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
  signedAmountUsd: number | null;
  direction: "inflow" | "outflow" | "unknown";
  currency: string;
  status: string;
};

type LedgerTransactionBreakdown = {
  currency: string;
  source: LedgerSource;
  inflow: number;
  outflow: number;
  net: number;
  usdInflow: number;
  usdOutflow: number;
  usdNet: number;
  usdConvertibleTransactionCount: number;
  transactionCount: number;
};

type LedgerDashboardData = {
  asOf: string;
  windowDays: number;
  entities: Array<{ id: string; name: string; code: string | null; orgId: string }>;
  accounts: LedgerAccount[];
  totalsByAccountType: Array<{ accountType: AccountType; currency: string; amount: number; accountCount: number }>;
  transactionBreakdowns: LedgerTransactionBreakdown[];
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

type LiquidityMixRow = {
  accountType: AccountType;
  label: string;
  detail: string;
  amountUsd: number;
  accountCount: number;
  color: string;
};

type CommentaryMetric = {
  label: string;
  value: string;
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
  if (accountType === "client_money") return "Client Funds";
  if (accountType === "money_processor") return "Money Processors";
  if (accountType === "liquidity_provider") return "Liquidity Providers";
  return "Own Funds";
}

const categoryOrder: AccountType[] = ["operating_bank", "client_money", "money_processor", "liquidity_provider"];

const categoryColors: Record<AccountType, string> = {
  operating_bank: "#2f6f68",
  client_money: "#8aa05d",
  money_processor: "#bf7a3a",
  liquidity_provider: "#5967c5",
};

const categoryChartLabels: Record<AccountType, string> = {
  operating_bank: "Own Funds",
  client_money: "Client Funds",
  money_processor: "Money Processors",
  liquidity_provider: "Liquidity Providers",
};

function formatMoney(currency: string, amount: number, compact = false) {
  return new Intl.NumberFormat("en", {
    style: currency === "USD" ? "currency" : "decimal",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(amount);
}

function formatUsdCompact(amount: number) {
  return formatMoney("USD", amount, true).replace("$", "US$");
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

function hasNonZeroBalance(account: LedgerAccount) {
  return Boolean(account.latestBalance && account.latestBalance.amount !== 0);
}

function sumUsd(accounts: LedgerAccount[]) {
  return accounts.reduce((total, account) => total + (balanceUsd(account) ?? 0), 0);
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
            ? entityNameById.get(account.entityId) ?? "Unassigned entity"
            : groupBy === "accountType"
              ? accountTypeLabel(account.accountType)
              : account.accountName,
        detail:
          groupBy === "entity"
            ? "USD account balances"
            : groupBy === "accountType"
              ? "USD balance by treasury category"
              : `${entityNameById.get(account.entityId) ?? "Unassigned entity"} · ${accountTypeLabel(account.accountType)}`,
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
    label: "Other/Remaining",
    detail: `${remainingRows.length} ${relationshipLabel} represented`,
    amountUsd: remainingRows.reduce((total, row) => total + row.amountUsd, 0),
    accountCount: remainingRows.reduce((total, row) => total + row.accountCount, 0),
  });
  return visibleRows;
}

function liquidityMixRows(rows: ExposureRow[]): LiquidityMixRow[] {
  const rowsByType = new Map(rows.map((row) => [row.id, row]));

  return categoryOrder.map((accountType) => {
    const row = rowsByType.get(accountType);
    return {
      accountType,
      label: categoryChartLabels[accountType],
      detail: accountTypeLabel(accountType),
      amountUsd: row?.amountUsd ?? 0,
      accountCount: row?.accountCount ?? 0,
      color: categoryColors[accountType],
    };
  });
}

function pieBackground(rows: LiquidityMixRow[]) {
  const positiveRows = rows.filter((row) => Math.abs(row.amountUsd) > 0);
  const total = positiveRows.reduce((sum, row) => sum + Math.abs(row.amountUsd), 0);
  if (!total) return "#f4f4f5";

  let cursor = 0;
  const segments = positiveRows.map((row, index) => {
    const start = cursor;
    const end = index === positiveRows.length - 1 ? 360 : cursor + (Math.abs(row.amountUsd) / total) * 360;
    cursor = end;
    return `${row.color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
  });

  return `conic-gradient(${segments.join(", ")})`;
}

function sortMixRowsByExposure(rows: LiquidityMixRow[]) {
  return [...rows].sort((left, right) => {
    const amountDifference = Math.abs(right.amountUsd) - Math.abs(left.amountUsd);
    if (amountDifference !== 0) return amountDifference;
    return categoryOrder.indexOf(left.accountType) - categoryOrder.indexOf(right.accountType);
  });
}

function absoluteMixTotal(rows: LiquidityMixRow[]) {
  return rows.reduce((sum, row) => sum + Math.abs(row.amountUsd), 0);
}

function buildTreasuryCommentary(data: LedgerDashboardData | null, xeroStatus: XeroStatus | null) {
  if (!data) {
    return {
      headline: "Waiting for ledger data",
      points: ["Executive treasury read will appear once balances and recent movements load."],
      connectionNote: "Ledger Source: Checking Connection",
      metrics: [] as CommentaryMetric[],
    };
  }

  const mixRows = liquidityMixRows(groupExposure(data.accounts, new Map(data.entities.map((entity) => [entity.id, entity.name])), "accountType"));
  const ownFunds = Math.abs(mixRows.find((row) => row.accountType === "operating_bank")?.amountUsd ?? 0);
  const externalFloat = absoluteMixTotal(mixRows.filter((row) => row.accountType === "money_processor" || row.accountType === "liquidity_provider"));
  const totalExposure = absoluteMixTotal(mixRows);
  const ownFundsShare = totalExposure ? ownFunds / totalExposure : 0;
  const recentMovements = data.recentTransactions;
  const inflowCount = recentMovements.filter((transaction) => transaction.direction === "inflow" || transaction.signedAmount > 0).length;
  const outflowCount = recentMovements.filter((transaction) => transaction.direction === "outflow" || transaction.signedAmount < 0).length;
  const usdInflow = data.transactionBreakdowns.reduce((sum, breakdown) => sum + breakdown.usdInflow, 0);
  const usdOutflow = data.transactionBreakdowns.reduce((sum, breakdown) => sum + breakdown.usdOutflow, 0);
  const usdNet = data.transactionBreakdowns.reduce((sum, breakdown) => sum + breakdown.usdNet, 0);
  const transferEliminations = estimateInternalTransferEliminations(recentMovements);
  const estimatedExternalInflow = Math.max(0, usdInflow - transferEliminations.eliminatedUsd);
  const estimatedExternalOutflow = Math.max(0, usdOutflow - transferEliminations.eliminatedUsd);
  const largestCategory = sortMixRowsByExposure(mixRows)[0];
  const largestCategoryShare = largestCategory && totalExposure ? Math.abs(largestCategory.amountUsd) / totalExposure : 0;
  const movementBias =
    usdNet > 0
      ? "Cash Building"
      : usdNet < 0
        ? "Cash Burning"
        : inflowCount > outflowCount
          ? "Activity Heavy On Receipts"
          : outflowCount > inflowCount
            ? "Activity Heavy On Payments"
            : "Balanced";
  const connectionNote = xeroStatus?.connected ? "Ledger Source: Xero Connected" : "Ledger Source: Not Connected";
  const netMovementLabel = formatUsdCompact(usdNet);
  const inflowValueLabel = formatUsdCompact(estimatedExternalInflow);
  const outflowValueLabel = formatUsdCompact(estimatedExternalOutflow);
  const eliminatedTransferLabel = formatUsdCompact(transferEliminations.eliminatedUsd);
  const concentrationNote =
    ownFundsShare >= 0.65
      ? "Own Funds dominate visible liquidity, keeping operating cash clear."
      : externalFloat >= totalExposure * 0.2
        ? "Processor and provider balances are material enough to watch for settlement timing."
        : "Liquidity is relatively diversified across treasury categories.";
  const movementPoint = recentMovements.length
    ? transferEliminations.eliminatedUsd > 0
      ? `${recentMovements.length} movements: ${inflowValueLabel} inflows, ${outflowValueLabel} outflows, ${netMovementLabel} net after ${eliminatedTransferLabel} internal transfers.`
      : `${recentMovements.length} movements: ${inflowValueLabel} inflows, ${outflowValueLabel} outflows, ${netMovementLabel} net. No likely internal transfers detected.`
    : `No posted movements in the last ${data.windowDays} days.`;
  const concentrationPoint = largestCategory ? `${largestCategory.label} leads at ${formatPercent(largestCategoryShare)} of visible USD exposure. ${concentrationNote}` : concentrationNote;

  return {
    headline: `Executive Read: ${movementBias}`,
    points: [movementPoint, concentrationPoint],
    connectionNote,
    metrics: [
      { label: "Net Cash Movement", value: netMovementLabel },
      { label: "External Inflows", value: inflowValueLabel },
      { label: "External Outflows", value: outflowValueLabel },
      { label: "Est. Internal Transfers", value: eliminatedTransferLabel },
    ],
  };
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

function Panel({ title, subtitle, children }: { title?: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      {title || subtitle ? (
        <div className="border-b border-zinc-100 px-4 py-3 sm:px-5">
          {title ? <h2 className="text-sm font-semibold text-zinc-950">{title}</h2> : null}
          {subtitle ? <p className="mt-1 text-xs leading-5 text-zinc-500">{subtitle}</p> : null}
        </div>
      ) : null}
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

function LiquidityMixCard({ rows, convertedCount }: { rows: ExposureRow[]; convertedCount: number }) {
  const mixRows = liquidityMixRows(rows);
  const displayRows = sortMixRowsByExposure(mixRows);
  const mixTotal = absoluteMixTotal(mixRows);
  const hasConvertedBalances = convertedCount > 0;
  const chartStyle = { background: pieBackground(mixRows) } satisfies CSSProperties;
  const chartLabel = hasConvertedBalances
    ? `Donut chart of USD liquidity. ${displayRows
        .map((row) => `${row.label}: ${formatPercent(mixTotal ? Math.abs(row.amountUsd / mixTotal) : 0)}, ${formatMoney("USD", row.amountUsd)}`)
        .join("; ")}.`
    : "Donut chart of USD liquidity. No converted balances available yet.";

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-zinc-100 px-4 py-4 sm:px-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-950">Liquidity Mix</div>
          <div className="mt-1 text-xs leading-5 text-zinc-500">
            USD balance distribution by treasury account type
          </div>
        </div>
        <div className="text-left lg:shrink-0 lg:text-right">
          <div className="text-[11px] font-semibold uppercase text-zinc-500">Total</div>
          <div className="mt-1 break-words text-xl font-semibold tabular-nums text-zinc-950 sm:text-2xl">
            {hasConvertedBalances ? formatUsdCompact(mixTotal) : "Unavailable"}
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-[minmax(15rem,18rem)_1fr] lg:items-center xl:gap-8">
        <div className="flex min-w-0 justify-center lg:justify-start">
          <div className="relative aspect-square w-full max-w-[18rem] rounded-full border border-zinc-200 shadow-inner" style={chartStyle} role="img" aria-label={chartLabel}>
            <div className="absolute inset-[28%] flex flex-col items-center justify-center rounded-full border border-zinc-100 bg-white text-center shadow-sm">
              <div className="text-[11px] font-semibold text-zinc-500">Total</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-zinc-950">{hasConvertedBalances ? formatMoney("USD", mixTotal, true) : "--"}</div>
            </div>
          </div>
        </div>
        <div className="min-w-0 divide-y divide-zinc-100">
          {displayRows.map((row) => {
            const share = mixTotal ? Math.abs(row.amountUsd / mixTotal) : 0;
            return (
              <div key={row.accountType} className="grid min-w-0 gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_5rem_8rem] sm:items-center">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="mt-1 size-2.5 shrink-0 rounded-full ring-2 ring-white" style={{ backgroundColor: row.color }} aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-950">{row.label}</div>
                    <div className="mt-0.5 truncate text-xs text-zinc-500">
                      {row.accountCount} account{row.accountCount === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
                <div className="text-left text-xs font-medium tabular-nums text-zinc-500 sm:text-right">{formatPercent(share)}</div>
                <div className="text-left text-sm font-semibold tabular-nums text-zinc-950 sm:text-right">{formatMoney("USD", row.amountUsd)}</div>
                <div className="sm:col-span-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200/70">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(3, Math.min(100, share * 100))}%`, backgroundColor: row.color }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
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
  const accountDetailRows = accounts.filter(hasNonZeroBalance);
  const convertedAccounts = accountsWithBalances.filter((account) => balanceUsd(account) !== null);
  const missingFxAccounts = accountsWithBalances.length - convertedAccounts.length;
  const totalUsd = sumUsd(convertedAccounts);
  const latestRefresh = latestIso(accountsWithBalances.map((account) => account.latestBalance?.asOf)) ?? ledgerData?.asOf ?? null;
  const entityExposure = useMemo(() => groupExposure(accounts, entityNameById, "entity"), [accounts, entityNameById]);
  const accountExposure = useMemo(() => groupExposure(accounts, entityNameById, "account"), [accounts, entityNameById]);
  const categoryExposure = useMemo(() => groupExposure(accounts, entityNameById, "accountType"), [accounts, entityNameById]);
  const treasuryCommentary = useMemo(() => buildTreasuryCommentary(ledgerData, xeroStatus), [ledgerData, xeroStatus]);
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
                <Spinner label="Checking Session" />
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
                <p className="text-xs font-semibold text-zinc-500">Treasury Workspace</p>
                <h1 className="mt-2 break-words text-2xl font-semibold text-zinc-950 sm:text-3xl">Treasury Dashboard</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                  Monitor cash positions, account balances, liquidity, and recent ledger movement from authenticated treasury data.
                </p>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <p className="text-xs leading-5 text-zinc-500 sm:text-right">
                  Data last updated: <span className="font-medium text-zinc-800">{latestRefresh ? formatDateTime(latestRefresh) : "Not synced yet"}</span>
                </p>
                <div className="flex flex-wrap gap-2 sm:justify-end">
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

          <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
            {ledgerLoading && !ledgerData ? (
              <StatSkeleton />
            ) : (
              <LiquidityMixCard rows={categoryExposure} convertedCount={convertedAccounts.length} />
            )}
            <Panel>
              <div className="space-y-4">
                <div>
                  <div className="text-base font-semibold text-zinc-950">{treasuryCommentary.headline}</div>
                  <div className="mt-3 space-y-2">
                    {treasuryCommentary.points.map((point) => (
                      <p key={point} className="text-sm leading-6 text-zinc-600">
                        {point}
                      </p>
                    ))}
                  </div>
                </div>
                {treasuryCommentary.metrics.length ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {treasuryCommentary.metrics.map((metric) => (
                      <div key={metric.label} className="min-w-0 border-t border-zinc-100 pt-3">
                        <div className="truncate text-[11px] font-medium text-zinc-500">{metric.label}</div>
                        <div className="mt-1 break-words text-sm font-semibold tabular-nums text-zinc-950">{metric.value}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="border-t border-zinc-100 pt-3 text-xs leading-5 text-zinc-500">{treasuryCommentary.connectionNote}</div>
              </div>
            </Panel>
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

          <section className="grid gap-4 xl:grid-cols-2">
            <Panel title="Liquidity by Entity" subtitle="USD balances grouped by entity, limited to accounts with available USD conversion.">
              <ExposureList rows={entityExposure} totalUsd={totalUsd} emptyLabel="No USD entity balances yet." />
            </Panel>

            <Panel title="Exposure by Account" subtitle="Largest account relationships by USD balance.">
              <ExposureList rows={accountExposure} totalUsd={totalUsd} emptyLabel="No USD account balances yet." maxRows={6} />
            </Panel>
          </section>

          <section>
            <Panel title="Recent Movements" subtitle={`Latest posted ledger activity from the past ${ledgerData?.windowDays ?? 30} days when available.`}>
              <div className="overflow-x-auto">
                <table className="min-w-[560px] divide-y divide-zinc-100 text-sm sm:min-w-full">
                  <thead className="bg-zinc-50 text-left text-xs font-medium text-zinc-500">
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

          <Panel title="Account Detail" subtitle="Latest balances with local amounts, USD value, source, and account status.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] table-fixed divide-y divide-zinc-100 text-sm">
                <colgroup>
                  <col className="w-[22%]" />
                  <col className="w-[23%]" />
                  <col className="w-[14%]" />
                  <col className="w-[9%]" />
                  <col className="w-[13%]" />
                  <col className="w-[12%]" />
                  <col className="w-[7%]" />
                </colgroup>
                <thead className="bg-zinc-50 text-left text-xs font-medium text-zinc-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">Entity</th>
                    <th scope="col" className="px-4 py-3">Account</th>
                    <th scope="col" className="px-4 py-3">Type</th>
                    <th scope="col" className="px-4 py-3">Source</th>
                    <th scope="col" className="px-4 py-3 text-right">Local balance</th>
                    <th scope="col" className="px-4 py-3 text-right">USD balance</th>
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
                  ) : accountDetailRows.length ? (
                    accountDetailRows.map((account) => {
                      const usdAmount = balanceUsd(account);
                      const latestBalance = account.latestBalance;
                      return (
                        <tr key={account.id} className="align-top">
                          <td className="px-4 py-3 font-medium text-zinc-950">
                            <div className="truncate">{entityNameById.get(account.entityId) ?? "Unassigned entity"}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="truncate font-medium text-zinc-900">{account.accountName}</div>
                            <div className="mt-1 text-xs text-zinc-500">{formatDate(latestBalance?.balanceDate)}</div>
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            <div className="truncate">{accountTypeLabel(account.accountType)}</div>
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            <div className="truncate">{sourceLabel(latestBalance?.source ?? account.source)}</div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-zinc-950">
                            {latestBalance ? formatLocalMoney(latestBalance.currency, latestBalance.amount) : "Not available"}
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
                        No non-zero account balances are available yet.
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
