"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { Notice, Spinner } from "@/components/ui";
import { adaptLedgerDashboardToBankBalanceData, type LedgerDashboardData } from "@/lib/bank-balance-tracker/ledger-adapter";
import {
  filterBalances,
  formatUploadCoverage,
  groupAccountEntityBalances,
  groupBankExposure,
  getLargestCountryMovement,
  getLargestLicenseSplit,
  groupCurrencyExposure,
  groupFundTypes,
  normalizeStatementStatus,
  percentOf,
  sortBalances,
  statementReadiness,
  uniqueSorted,
  usedFxRates,
  type BalanceFilters,
  type BalanceSortKey,
} from "@/lib/bank-balance-tracker/transforms";
import type {
  BankBalanceWorkbookData,
  BankConcentrationRow,
  CountrySummaryRow,
  FxRateRow,
  LicenseSummaryRow,
  MonthlyBalanceRow,
  TopBankRow,
} from "@/lib/bank-balance-tracker/types";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type TrackerTab = "overview" | "balances" | "operations" | "fx";

type DataSourceState = "loading" | "ledger" | "unavailable";

const selectClassName =
  "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition focus:border-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950";

const inputClassName =
  "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950";

const emptyBankBalanceData: Pick<BankBalanceWorkbookData, "bankMapping" | "statementUploads"> = {
  bankMapping: [],
  statementUploads: {
    columns: [],
    rows: [],
  },
};

function formatUsd(value: number, compact = false) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value);
}

function formatNumber(value: number, fractionDigits = 2) {
  return new Intl.NumberFormat("en", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function formatPct(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  return new Intl.NumberFormat("en", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function movementClass(value: number | null) {
  if (value === null) return "text-zinc-500";
  if (value > 0) return "text-emerald-800";
  if (value < 0) return "text-red-800";
  return "text-zinc-600";
}

function formatUsdOrUnavailable(value: number | null | undefined, compact = false) {
  return value === null || value === undefined ? "Unavailable" : formatUsd(value, compact);
}

export default function BankBalanceTrackerPage() {
  const [data, setData] = useState<BankBalanceWorkbookData | null>(null);
  const [dataSource, setDataSource] = useState<DataSourceState>("loading");
  const [dataNotice, setDataNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<TrackerTab>(() => {
    if (typeof window === "undefined") return "overview";
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (requestedTab === "overview" || requestedTab === "balances" || requestedTab === "operations" || requestedTab === "fx") return requestedTab;
    return "overview";
  });
  const [filters, setFilters] = useState<BalanceFilters>({ country: "", fundType: "", currency: "", search: "" });
  const [sortKey, setSortKey] = useState<BalanceSortKey>("balanceUsd");
  const [fxSearch, setFxSearch] = useState("");
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!supabase) throw new Error("Authentication is not configured for this deployment.");

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!sessionData.session) throw new Error("Sign in to load live bank ledger balances.");

        const response = await fetch("/api/dashboard/ledger", {
          headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        });
        const body = (await response.json()) as LedgerDashboardData | { error?: string };
        if (!response.ok) throw new Error("error" in body && body.error ? body.error : "Failed to load bank ledger balances.");

        const ledgerData = adaptLedgerDashboardToBankBalanceData(body as LedgerDashboardData, []);
        if (!ledgerData) throw new Error("No bank ledger balances are available yet.");
        if (cancelled) return;

        setData(ledgerData);
        setDataSource("ledger");
        setDataNotice(null);
      } catch (error) {
        if (cancelled) return;
        setData(null);
        setDataSource("unavailable");
        setDataNotice(error instanceof Error ? error.message : "Live bank ledger balances are unavailable.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const countries = useMemo(() => uniqueSorted(data?.monthlyBalances.map((row) => row.country) ?? []), [data]);
  const fundTypes = useMemo(() => uniqueSorted(data?.monthlyBalances.map((row) => row.fundType) ?? []), [data]);
  const currencies = useMemo(() => uniqueSorted(data?.monthlyBalances.map((row) => row.currency) ?? []), [data]);
  const filteredBalances = useMemo(() => sortBalances(filterBalances(data?.monthlyBalances ?? [], filters), sortKey), [data, filters, sortKey]);
  const usdConvertedBalances = useMemo(() => data?.monthlyBalances.filter((row) => row.balanceUsd !== null) ?? [], [data]);
  const currencyExposure = useMemo(() => groupCurrencyExposure(usdConvertedBalances), [usdConvertedBalances]);
  const accountEntityBalances = useMemo(() => groupAccountEntityBalances(usdConvertedBalances), [usdConvertedBalances]);
  const bankExposure = useMemo(() => groupBankExposure(usdConvertedBalances), [usdConvertedBalances]);
  const fundSplits = useMemo(() => groupFundTypes(usdConvertedBalances, data?.kpis.totalUsd ?? 0), [data, usdConvertedBalances]);
  const readiness = useMemo(() => statementReadiness(data ?? emptyBankBalanceData), [data]);
  const largestCountryMovement = useMemo(() => getLargestCountryMovement(data?.countrySummary ?? []), [data]);
  const largestLicense = useMemo(() => getLargestLicenseSplit(data?.licenseSummary ?? []), [data]);
  const usedRates = useMemo(() => usedFxRates(data?.fxRates ?? [], data?.monthlyBalances ?? []), [data]);
  const visibleFxRates = useMemo(() => {
    const query = fxSearch.trim().toLowerCase();
    if (!query) return data?.fxRates ?? [];
    return (data?.fxRates ?? []).filter((rate) => `${rate.currency} ${rate.name}`.toLowerCase().includes(query));
  }, [data, fxSearch]);
  const missingUsdRows = useMemo(() => data?.monthlyBalances.filter((row) => row.balanceUsd === null) ?? [], [data]);

  function selectTab(nextTab: TrackerTab) {
    setTab(nextTab);
    const url = new URL(window.location.href);
    if (nextTab === "overview") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", nextTab);
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
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
            <div className="min-w-0 text-sm font-medium text-zinc-700">Bank Balance Tracker</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard" className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950">
              Dashboard
            </Link>
            <Link href="/dashboard/invoices" className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950">
              Statement Intake
            </Link>
          </div>
        </header>

        <main className="mt-7 space-y-5">
          <section className="border-b border-zinc-200 pb-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-zinc-500">Mitrade Group</p>
                <h1 className="mt-2 break-words text-2xl font-semibold text-zinc-950 sm:text-3xl">{data?.metadata.title ?? "Mitrade Group Bank Balance Dashboard"}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                  {data
                    ? `Month end ${formatDate(data.metadata.selectedMonth)} bank balance dashboard with account identifiers masked while balances, mapping, and FX context stay available for treasury review.`
                    : "Authenticated bank ledger balances load here after Xero or ledger sync data is available."}
                </p>
              </div>
              <div className="grid gap-2 min-[520px]:grid-cols-2">
                <InfoPill label="Last refreshed" value={data ? formatDateTime(data.metadata.lastRefreshed) : "Unavailable"} />
                <InfoPill label="Data source" value={dataSource === "ledger" ? "Ledger API" : dataSource === "loading" ? "Loading" : "Unavailable"} />
              </div>
            </div>
          </section>

          {dataSource === "loading" ? (
            <Notice tone="info" title="Loading Bank Ledger">
              <Spinner label="Loading live balances" />
            </Notice>
          ) : null}

          {dataSource === "unavailable" && dataNotice ? (
            <Notice tone="warning" title="Live Ledger Unavailable">
              {dataNotice} Connect Xero, sync bank ledger data, or upload statements through Statement Intake, then refresh this dashboard.
            </Notice>
          ) : null}

          {missingUsdRows.length ? (
            <Notice tone="warning" title="Missing FX Conversion">
              {missingUsdRows.length} ledger balance{missingUsdRows.length === 1 ? "" : "s"} lack USD conversion and are excluded from USD totals. Local balances remain visible in the balance table.
            </Notice>
          ) : null}

          {data ? (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <KpiCard
                className="lg:col-span-2"
                label="Total USD"
                value={formatUsd(data.kpis.totalUsd)}
                detail={data.kpis.excludedUsdAccounts ? `${data.kpis.excludedUsdAccounts} account${data.kpis.excludedUsdAccounts === 1 ? "" : "s"} excluded for missing FX` : "Prior unavailable"}
              />
              <KpiCard label="Movement" value="Unavailable" detail="Latest ledger payload has no prior period" valueClassName={movementClass(null)} />
              <KpiCard label="Accounts" value={String(data.kpis.accounts)} detail={`${readiness.activeMappings} active mappings`} />
              <KpiCard label="Currencies" value={String(data.kpis.currencies)} detail={currencies.join(", ")} />
            </section>
          ) : null}

          {data ? (
            <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-zinc-100 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-zinc-950">Bank Balance Dashboard Views</h2>
                <p className="mt-1 text-sm leading-6 text-zinc-600">Review the same bank ledger data across summary, drilldown, upload readiness, and FX views.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 min-[520px]:flex">
                {[
                  ["overview", "Overview"],
                  ["balances", "Balances"],
                  ["operations", "Operations"],
                  ["fx", "FX Rates"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => selectTab(value as TrackerTab)}
                    aria-pressed={tab === value}
                    className={`h-10 rounded-lg px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 ${
                      tab === value ? "bg-zinc-950 text-white shadow-sm" : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-5">
              {tab === "overview" ? (
                <OverviewPanel
                  countrySummary={data.countrySummary}
                  licenseSummary={data.licenseSummary}
                  topBanks={data.topBanks}
                  concentration={data.concentration}
                  fundSplits={fundSplits}
                  currencyExposure={currencyExposure}
                  accountEntityBalances={accountEntityBalances}
                  bankExposure={bankExposure}
                  largestCountryMovement={largestCountryMovement}
                  largestLicense={largestLicense}
                />
              ) : null}

              {tab === "balances" ? (
                <BalancesPanel
                  balances={filteredBalances}
                  countries={countries}
                  fundTypes={fundTypes}
                  currencies={currencies}
                  filters={filters}
                  sortKey={sortKey}
                  onFiltersChange={setFilters}
                  onSortChange={setSortKey}
                />
              ) : null}

              {tab === "operations" ? (
                <OperationsPanel readiness={readiness} bankMapping={data.bankMapping} statementColumns={data.statementUploads.columns} />
              ) : null}

              {tab === "fx" ? <FxPanel usedRates={usedRates} rates={visibleFxRates} search={fxSearch} onSearchChange={setFxSearch} /> : null}
            </div>
            </section>
          ) : dataSource !== "loading" ? (
            <Notice tone="info" title="No Bank Ledger Data">
              This dashboard is intentionally empty until authenticated ledger or Xero-backed balances are available.
            </Notice>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white/80 px-4 py-3 text-sm shadow-sm">
      <div className="text-xs font-semibold uppercase text-zinc-500">{label}</div>
      <div className="mt-1 font-medium text-zinc-900">{value}</div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  detail,
  className = "",
  valueClassName = "text-zinc-950",
}: {
  label: string;
  value: string;
  detail: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={`min-w-0 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="text-xs font-semibold uppercase text-zinc-500">{label}</div>
      <div className={`mt-2 break-words text-xl font-semibold tabular-nums ${valueClassName}`}>{value}</div>
      <div className="mt-2 text-xs leading-5 text-zinc-500">{detail}</div>
    </div>
  );
}

function OverviewPanel({
  countrySummary,
  licenseSummary,
  topBanks,
  concentration,
  fundSplits,
  currencyExposure,
  accountEntityBalances,
  bankExposure,
  largestCountryMovement,
  largestLicense,
}: {
  countrySummary: CountrySummaryRow[];
  licenseSummary: LicenseSummaryRow[];
  topBanks: TopBankRow[];
  concentration: BankConcentrationRow[];
  fundSplits: Array<{ fundType: string; balanceUsd: number; accountCount: number; shareOfTotal: number }>;
  currencyExposure: Array<{ currency: string; balanceUsd: number; accountCount: number; missingUsdCount: number }>;
  accountEntityBalances: Array<{ accountEntity: string; balanceUsd: number; movementUsd: number | null; accountCount: number }>;
  bankExposure: Array<{ bank: string; balanceUsd: number; movementUsd: number | null; accountCount: number }>;
  largestCountryMovement: CountrySummaryRow | null;
  largestLicense: LicenseSummaryRow | null;
}) {
  const maxCountryUsd = Math.max(...countrySummary.map((row) => row.currentMonthUsd), 1);
  const totalLicenseUsd = licenseSummary.reduce((total, row) => total + row.totalUsd, 0);
  const highConcentration = concentration.filter((row) => row.concentrationLevel === "High").slice(0, 6);
  const maxAccountEntityUsd = Math.max(...accountEntityBalances.map((row) => Math.abs(row.balanceUsd)), 1);
  const maxBankUsd = Math.max(...bankExposure.map((row) => Math.abs(row.balanceUsd)), 1);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <Notice tone="info" title="Movement Context">
          {largestCountryMovement
            ? `${largestCountryMovement.country} has USD balance coverage of ${formatUsd(largestCountryMovement.currentMonthUsd)}. Prior period movement is unavailable in the latest ledger payload.`
            : "No country movement data is available."}
        </Notice>
        <Notice tone="success" title="License Split">
          {largestLicense ? `${largestLicense.license} is the largest license total at ${formatUsd(largestLicense.totalUsd)}.` : "No license split is available."}
        </Notice>
        <Notice tone="warning" title="Concentration Review">
          {highConcentration.length ? `${highConcentration.length} high-concentration bank relationships are highlighted for treasury review.` : "No high concentration relationships found."}
        </Notice>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Top Account / Entity Balances" subtitle="Top account and entity balances by USD value, with month movement.">
          <div className="space-y-3">
            {accountEntityBalances.slice(0, 8).map((row) => (
              <HorizontalMetricBar
                key={row.accountEntity}
                label={row.accountEntity}
                value={formatUsd(row.balanceUsd)}
                detail={`${row.accountCount} row${row.accountCount === 1 ? "" : "s"} · movement unavailable`}
                percent={percentOf(row.balanceUsd, maxAccountEntityUsd)}
                tone="sky"
              />
            ))}
          </div>
        </Panel>

        <Panel title="Bank Exposure Mix" subtitle="Largest bank relationships across all mapped entities.">
          <div className="space-y-3">
            {bankExposure.slice(0, 7).map((row) => (
              <HorizontalMetricBar
                key={row.bank}
                label={row.bank}
                value={formatUsd(row.balanceUsd, true)}
                detail={`${row.accountCount} row${row.accountCount === 1 ? "" : "s"} · movement unavailable`}
                percent={percentOf(row.balanceUsd, maxBankUsd)}
                tone="emerald"
              />
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Country Summary" subtitle="Current USD for balances with available FX conversion. Prior period movement is unavailable.">
          <div className="space-y-3">
            {countrySummary.map((row) => (
              <div key={row.country}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0 font-medium text-zinc-950">{row.country}</div>
                  <div className="shrink-0 text-right tabular-nums font-semibold text-zinc-950">{formatUsd(row.currentMonthUsd)}</div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full rounded-full bg-sky-700" style={{ width: `${percentOf(row.currentMonthUsd, maxCountryUsd)}%` }} />
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 text-xs text-zinc-500">
                  <span>Prior unavailable</span>
                  <span className={movementClass(row.movementUsd)}>
                    Movement unavailable
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="License Client / Corporate Split" subtitle="Regulatory and source view by license or balance source.">
          <div className="space-y-4">
            {licenseSummary.map((row) => (
              <div key={row.license}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="font-medium text-zinc-950">{row.license}</div>
                  <div className="tabular-nums font-semibold text-zinc-950">{formatUsd(row.totalUsd)}</div>
                </div>
                <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-zinc-100">
                  <div className="bg-emerald-700" style={{ width: `${percentOf(row.clientFundsUsd, row.totalUsd)}%` }} aria-label={`${row.license} client funds`} />
                  <div className="bg-amber-600" style={{ width: `${percentOf(row.corporateFundsUsd, row.totalUsd)}%` }} aria-label={`${row.license} corporate funds`} />
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-zinc-500">
                  <span>Client {formatUsd(row.clientFundsUsd)}</span>
                  <span className="text-right">Corporate {formatUsd(row.corporateFundsUsd)}</span>
                </div>
              </div>
            ))}
            <div className="rounded-lg bg-zinc-50 p-3 text-xs leading-5 text-zinc-600">Total license coverage: {formatUsd(totalLicenseUsd)}.</div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Top Banks by USD Balance" subtitle="Largest bank balances in the dashboard.">
          <CompactTable
            headers={["Bank", "Total", "Move"]}
            rows={topBanks.map((row) => [
              row.bank,
              formatUsd(row.totalUsd, true),
              <span key={`${row.bank}-move`} className={movementClass(row.movementUsd)}>
                Unavailable
              </span>,
            ])}
          />
        </Panel>

        <Panel title="Fund Type Split" subtitle="Client and corporate treasury segmentation.">
          <div className="space-y-3">
            {fundSplits.map((row) => (
              <div key={row.fundType} className="rounded-lg border border-zinc-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-950">{row.fundType}</div>
                    <div className="mt-1 text-xs text-zinc-500">{row.accountCount} account{row.accountCount === 1 ? "" : "s"}</div>
                  </div>
                  <div className="text-right text-sm font-semibold tabular-nums text-zinc-950">{formatUsd(row.balanceUsd)}</div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full rounded-full bg-emerald-700" style={{ width: `${percentOf(row.shareOfTotal, 1)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Currency Exposure" subtitle="USD-converted exposure by source currency.">
          <CompactTable
            headers={["Currency", "USD", "Rows"]}
            rows={currencyExposure.map((row) => [row.currency, row.missingUsdCount ? `${formatUsd(row.balanceUsd, true)}*` : formatUsd(row.balanceUsd, true), String(row.accountCount)])}
          />
        </Panel>
      </div>

      <Panel title="High Concentration Relationships" subtitle="Entity and bank combinations marked High for treasury review.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {highConcentration.map((row) => (
            <div key={`${row.entityGroup}:${row.bank}`} className="rounded-lg border border-zinc-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-zinc-950">{row.bank}</div>
                  <div className="mt-1 truncate text-xs text-zinc-500">{row.entityGroup}</div>
                </div>
                <span className="shrink-0 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-800">High</span>
              </div>
              <div className="mt-3 text-sm font-semibold tabular-nums text-zinc-950">{formatUsd(row.totalUsd)}</div>
              <div className="mt-1 text-xs text-zinc-500">Share {formatPct(row.proportion)} · HHI {formatNumber(row.hhiIndex, 3)}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function HorizontalMetricBar({
  label,
  value,
  detail,
  percent,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  percent: number;
  tone: "sky" | "emerald";
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3 text-sm">
        <div className="min-w-0">
          <div className="truncate font-medium text-zinc-950">{label}</div>
          <div className="mt-1 text-xs text-zinc-500">{detail}</div>
        </div>
        <div className="shrink-0 text-right tabular-nums font-semibold text-zinc-950">{value}</div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full rounded-full ${tone === "sky" ? "bg-sky-700" : "bg-emerald-700"}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function BalancesPanel({
  balances,
  countries,
  fundTypes,
  currencies,
  filters,
  sortKey,
  onFiltersChange,
  onSortChange,
}: {
  balances: MonthlyBalanceRow[];
  countries: string[];
  fundTypes: string[];
  currencies: string[];
  filters: BalanceFilters;
  sortKey: BalanceSortKey;
  onFiltersChange: (filters: BalanceFilters) => void;
  onSortChange: (sortKey: BalanceSortKey) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="block text-sm font-medium text-zinc-700">
          Search
          <input
            value={filters.search}
            onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            className={`mt-1 ${inputClassName}`}
            placeholder="Entity, bank, currency"
          />
        </label>
        <SelectFilter label="Country" value={filters.country} options={countries} allLabel="All countries" onChange={(value) => onFiltersChange({ ...filters, country: value })} />
        <SelectFilter label="Fund type" value={filters.fundType} options={fundTypes} allLabel="All fund types" onChange={(value) => onFiltersChange({ ...filters, fundType: value })} />
        <SelectFilter label="Currency" value={filters.currency} options={currencies} allLabel="All currencies" onChange={(value) => onFiltersChange({ ...filters, currency: value })} />
        <label className="block text-sm font-medium text-zinc-700">
          Sort
          <select value={sortKey} onChange={(event) => onSortChange(event.target.value as BalanceSortKey)} className={`mt-1 ${selectClassName}`}>
            <option value="balanceUsd">Largest USD balance</option>
            <option value="movementUsd">Largest movement</option>
            <option value="movementPct">Largest movement %</option>
            <option value="country">Country</option>
            <option value="bank">Bank</option>
          </select>
        </label>
      </div>

      <Panel title="Monthly Balances" subtitle={`${balances.length} balance rows after filters. Account numbers are masked in source and UI.`} flush>
        <div className="max-h-[640px] overflow-auto">
          <table className="min-w-[1120px] divide-y divide-zinc-100 text-sm">
            <thead className="sticky top-0 bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-500">
              <tr>
                <th scope="col" className="px-4 py-3">Country</th>
                <th scope="col" className="px-4 py-3">Account / Entity</th>
                <th scope="col" className="px-4 py-3">Bank</th>
                <th scope="col" className="px-4 py-3">Account</th>
                <th scope="col" className="px-4 py-3">Fund</th>
                <th scope="col" className="px-4 py-3">Currency</th>
                <th scope="col" className="px-4 py-3 text-right">Local</th>
                <th scope="col" className="px-4 py-3 text-right">USD</th>
                <th scope="col" className="px-4 py-3 text-right">Movement</th>
                <th scope="col" className="px-4 py-3 text-right">Move %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {balances.length ? (
                balances.map((row, index) => (
                  <tr key={`${row.country}:${row.bank}:${row.accountEntity}:${index}`} className="align-top">
                    <td className="px-4 py-3 font-medium text-zinc-950">{row.country}</td>
                    <td className="max-w-72 px-4 py-3 text-zinc-800">{row.accountEntity}</td>
                    <td className="max-w-56 px-4 py-3 text-zinc-700">{row.bank}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{row.maskedAccountNo}</td>
                    <td className="px-4 py-3 text-zinc-700">{row.fundType}</td>
                    <td className="px-4 py-3 text-zinc-700">{row.currency}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-700">{formatNumber(row.balanceLocal, Math.abs(row.balanceLocal) >= 1000 ? 0 : 2)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-zinc-950">{formatUsdOrUnavailable(row.balanceUsd)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${movementClass(row.movementUsd)}`}>{formatUsdOrUnavailable(row.movementUsd)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${movementClass(row.movementUsd)}`}>{formatPct(row.movementPct)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-zinc-500" colSpan={10}>
                    No balance rows match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function OperationsPanel({
  readiness,
  bankMapping,
  statementColumns,
}: {
  readiness: ReturnType<typeof statementReadiness>;
  bankMapping: Array<{ country: string; accountEntity: string; bank: string; maskedAccountNo: string; fundType: string; currency: string; defaultActive: boolean; statementMatchingNotes: string | null }>;
  statementColumns: string[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <KpiCard label="Upload Readiness" value={normalizeStatementStatus(readiness.uploadRows)} detail={formatUploadCoverage(readiness)} />
        <KpiCard label="Mapped Accounts" value={String(readiness.mappedAccounts)} detail={`${readiness.unmappedAccounts} inactive mappings`} />
        <KpiCard label="Statement Columns" value={String(statementColumns.length)} detail={statementColumns.join(", ")} />
      </div>

      <Notice tone="info" title="Statement Upload Queue">
        The statement intake queue is ready for bank files and does not mutate production data from this dashboard.
      </Notice>

      <Panel title="Bank Mapping" subtitle={`${bankMapping.length} account mappings. Full account numbers are masked.`} flush>
        <div className="max-h-[560px] overflow-auto">
          <table className="min-w-[920px] divide-y divide-zinc-100 text-sm">
            <thead className="sticky top-0 bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-500">
              <tr>
                <th scope="col" className="px-4 py-3">Country</th>
                <th scope="col" className="px-4 py-3">Entity / Account</th>
                <th scope="col" className="px-4 py-3">Bank</th>
                <th scope="col" className="px-4 py-3">Account</th>
                <th scope="col" className="px-4 py-3">Fund</th>
                <th scope="col" className="px-4 py-3">Currency</th>
                <th scope="col" className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {bankMapping.map((row, index) => (
                <tr key={`${row.country}:${row.bank}:${row.accountEntity}:${index}`} className="align-top">
                  <td className="px-4 py-3 font-medium text-zinc-950">{row.country}</td>
                  <td className="max-w-72 px-4 py-3 text-zinc-800">{row.accountEntity}</td>
                  <td className="max-w-56 px-4 py-3 text-zinc-700">{row.bank}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">{row.maskedAccountNo}</td>
                  <td className="px-4 py-3 text-zinc-700">{row.fundType}</td>
                  <td className="px-4 py-3 text-zinc-700">{row.currency}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-md px-2 py-1 text-xs font-medium ${row.defaultActive ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-600"}`}>
                      {row.defaultActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function FxPanel({
  usedRates,
  rates,
  search,
  onSearchChange,
}: {
  usedRates: FxRateRow[];
  rates: FxRateRow[];
  search: string;
  onSearchChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Panel title="Dashboard Currencies" subtitle={`Rates used by ${usedRates.length} dashboard currencies.`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {usedRates.map((rate) => (
            <div key={rate.currency} className="rounded-lg border border-zinc-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-950">{rate.currency}</div>
                  <div className="mt-1 text-xs text-zinc-500">{rate.name}</div>
                </div>
                <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">Used</span>
              </div>
              <div className="mt-3 text-sm tabular-nums text-zinc-700">{formatNumber(rate.unitsPerUsd, 4)} units per USD</div>
              <div className="mt-1 text-xs tabular-nums text-zinc-500">{formatNumber(rate.usdPerUnit, 6)} USD per unit</div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <label className="block text-sm font-medium text-zinc-700">
          Search FX reference
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} className={`mt-1 ${inputClassName}`} placeholder="Currency code or name" />
        </label>
        <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 shadow-sm">{rates.length} displayed rates</div>
      </div>

      <Panel title="XE Rates Reference" subtitle="Live ledger FX conversion rates available to this dashboard." flush>
        <div className="max-h-[560px] overflow-auto">
          <table className="min-w-[680px] divide-y divide-zinc-100 text-sm">
            <thead className="sticky top-0 bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-500">
              <tr>
                <th scope="col" className="px-4 py-3">Currency</th>
                <th scope="col" className="px-4 py-3">Name</th>
                <th scope="col" className="px-4 py-3 text-right">Units per USD</th>
                <th scope="col" className="px-4 py-3 text-right">USD per unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {rates.length ? (
                rates.map((rate) => (
                  <tr key={rate.currency}>
                    <td className="px-4 py-3 font-semibold text-zinc-950">{rate.currency}</td>
                    <td className="px-4 py-3 text-zinc-700">{rate.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-700">{formatNumber(rate.unitsPerUsd, 6)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-700">{formatNumber(rate.usdPerUnit, 8)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-zinc-500" colSpan={4}>
                    No FX rates match this search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function SelectFilter({
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  allLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium text-zinc-700">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className={`mt-1 ${selectClassName}`}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Panel({
  title,
  subtitle,
  children,
  flush = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-zinc-950">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs leading-5 text-zinc-500">{subtitle}</p> : null}
      </div>
      <div className={flush ? "min-w-0" : "p-4 sm:p-5"}>{children}</div>
    </section>
  );
}

function CompactTable({ headers, rows }: { headers: string[]; rows: Array<Array<ReactNode>> }) {
  return (
    <div className="overflow-x-auto" role="region" tabIndex={0} aria-label={`Scrollable table: ${headers.join(", ")}`}>
      <table className="min-w-full divide-y divide-zinc-100 text-sm">
        <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-500">
          <tr>
            {headers.map((header, index) => (
              <th key={header} scope="col" className={`px-3 py-2 ${index > 0 ? "text-right" : ""}`}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className={`px-3 py-2 ${cellIndex === 0 ? "max-w-48 text-zinc-800" : "text-right tabular-nums text-zinc-700"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
