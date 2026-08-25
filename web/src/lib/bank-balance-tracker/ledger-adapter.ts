import type { BankBalanceWorkbookData, FxRateRow } from "./types";

type LedgerSource = "manual" | "xero" | "bank_feed";

type LedgerAccount = {
  id: string;
  entityId: string;
  accountName: string;
  currency: string | null;
  source: LedgerSource;
  latestBalance: {
    amount: number;
    currency: string;
    originalCurrency: string;
    source: LedgerSource;
    balanceDate: string;
    asOf: string;
    usdConversion: {
      amount: number;
      rate: number;
      rateDate: string;
      asOf: string;
      source: string;
    } | null;
  } | null;
};

type LedgerDataQualityIssue = {
  code: string;
  severity: "warning";
  message: string;
  entityId: string;
  bankAccountId: string;
  balanceId?: string;
  currency: string;
};

export type LedgerDashboardData = {
  asOf: string;
  entities: Array<{ id: string; name: string; code: string | null; orgId: string }>;
  accounts: LedgerAccount[];
  totalsBySource: Array<{ source: LedgerSource; currency: string; amount: number; accountCount: number }>;
  dataQualityIssues?: LedgerDataQualityIssue[];
};

function sourceLabel(source: LedgerSource) {
  if (source === "xero") return "Xero";
  if (source === "bank_feed") return "Bank Feed";
  return "Manual";
}

function balanceUsd(account: LedgerAccount) {
  const balance = account.latestBalance;
  if (!balance) return null;
  if (balance.usdConversion) return balance.usdConversion.amount;
  return balance.currency === "USD" ? balance.amount : null;
}

function concentrationLevel(share: number): "Low" | "Moderate" | "High" {
  if (share >= 0.25) return "High";
  if (share >= 0.1) return "Moderate";
  return "Low";
}

function maskedAccountId(id: string) {
  const suffix = id.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase();
  return suffix ? `...${suffix}` : "Masked";
}

function makeFxRates(accounts: LedgerAccount[], fallbackRates: FxRateRow[]) {
  const byCurrency = new Map(fallbackRates.map((rate) => [rate.currency, rate]));

  for (const account of accounts) {
    const balance = account.latestBalance;
    const currency = balance?.currency || account.currency || "";
    if (!currency || byCurrency.has(currency)) continue;

    const usdPerUnit = balance?.usdConversion?.rate ?? (currency === "USD" ? 1 : 0);
    byCurrency.set(currency, {
      currency,
      name: currency,
      unitsPerUsd: usdPerUnit ? 1 / usdPerUnit : 0,
      usdPerUnit,
    });
  }

  return Array.from(byCurrency.values()).sort((left, right) => left.currency.localeCompare(right.currency));
}

export function adaptLedgerDashboardToBankBalanceData(payload: LedgerDashboardData, fallbackRates: FxRateRow[]): BankBalanceWorkbookData | null {
  const accountsWithBalances = payload.accounts.filter((account) => account.latestBalance);
  if (!accountsWithBalances.length) return null;

  const entityById = new Map(payload.entities.map((entity) => [entity.id, entity]));
  const currencies = new Set(accountsWithBalances.map((account) => account.latestBalance?.currency || account.currency || "Unspecified"));
  const selectedMonth = accountsWithBalances
    .map((account) => account.latestBalance?.balanceDate)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0];

  const monthlyBalances = accountsWithBalances.map((account) => {
    const latest = account.latestBalance;
    const currentUsd = balanceUsd(account);
    const currency = latest?.currency || account.currency || "Unspecified";
    const hasMissingUsd = currentUsd === null;
    const source = sourceLabel(latest?.source ?? account.source);

    return {
      monthEnd: latest?.balanceDate ?? selectedMonth ?? payload.asOf.slice(0, 10),
      country: entityById.get(account.entityId)?.name ?? "Unknown Entity",
      accountEntity: entityById.get(account.entityId)?.name ?? "Unknown Entity",
      bank: account.accountName,
      maskedAccountNo: maskedAccountId(account.id),
      fundType: sourceLabel(latest?.source ?? account.source),
      currency,
      fxUnitsPerUsd: latest?.usdConversion?.rate ? 1 / latest.usdConversion.rate : currency === "USD" ? 1 : null,
      balanceLocal: latest?.amount ?? 0,
      balanceUsd: currentUsd,
      priorMonthUsd: null,
      movementUsd: null,
      movementPct: null,
      sourceWorkbook: `${source} ledger`,
      statementFileRef: null,
      notes: hasMissingUsd
        ? `Balance as of ${latest?.asOf ?? "latest sync"}. USD conversion is unavailable for ${currency}; excluded from USD totals.`
        : latest?.asOf
          ? `Balance as of ${latest.asOf}. Prior period and movement are unavailable in the latest ledger payload.`
          : "Prior period and movement are unavailable in the latest ledger payload.",
    };
  });

  const usdConvertedBalances = monthlyBalances.filter((row) => row.balanceUsd !== null);
  const totalUsd = usdConvertedBalances.reduce((total, row) => total + (row.balanceUsd ?? 0), 0);
  const excludedUsdAccounts = monthlyBalances.length - usdConvertedBalances.length;

  const countrySummary = Array.from(
    usdConvertedBalances.reduce((groups, row) => {
      const current = groups.get(row.country) ?? { country: row.country, priorMonthUsd: null, currentMonthUsd: 0, movementUsd: null, movementPct: null };
      current.currentMonthUsd += row.balanceUsd ?? 0;
      groups.set(row.country, current);
      return groups;
    }, new Map<string, { country: string; priorMonthUsd: number | null; currentMonthUsd: number; movementUsd: number | null; movementPct: number | null }>()),
  ).map(([, row]) => row);

  const licenseSummary = Array.from(
    usdConvertedBalances.reduce((groups, row) => {
      const current = groups.get(row.fundType) ?? { license: row.fundType, clientFundsUsd: 0, corporateFundsUsd: 0, totalUsd: 0 };
      current.totalUsd += row.balanceUsd ?? 0;
      if (row.fundType === "Xero") current.clientFundsUsd += row.balanceUsd ?? 0;
      else current.corporateFundsUsd += row.balanceUsd ?? 0;
      groups.set(row.fundType, current);
      return groups;
    }, new Map<string, { license: string; clientFundsUsd: number; corporateFundsUsd: number; totalUsd: number }>()),
  ).map(([, row]) => row);

  const topBanks = [...usdConvertedBalances]
    .sort((left, right) => Math.abs(right.balanceUsd ?? 0) - Math.abs(left.balanceUsd ?? 0))
    .slice(0, 10)
    .map((row) => ({ bank: row.bank, totalUsd: row.balanceUsd ?? 0, movementUsd: null }));

  const concentration = usdConvertedBalances.map((row) => {
    const balance = row.balanceUsd ?? 0;
    const share = totalUsd ? Math.abs(balance / totalUsd) : 0;
    return {
      entityGroup: row.accountEntity,
      bank: row.bank,
      totalUsd: balance,
      proportion: share,
      hhiIndex: share * share,
      concentrationLevel: concentrationLevel(share),
    };
  });

  return {
    metadata: {
      title: "Mitrade Group Bank Balance Dashboard",
      selectedMonth: selectedMonth ?? payload.asOf.slice(0, 10),
      lastRefreshed: payload.asOf,
      dashboardView: "Bank balances",
      workbookSheets: [],
      source: "Authenticated ledger API with Xero-backed bank balances when connected.",
    },
    kpis: {
      totalUsd,
      priorMonthUsd: null,
      movementUsd: null,
      movementPct: null,
      accounts: accountsWithBalances.length,
      currencies: currencies.size,
      excludedUsdAccounts,
    },
    countrySummary,
    licenseSummary,
    topBanks,
    concentration,
    monthlyBalances,
    bankMapping: accountsWithBalances.map((account) => ({
      country: entityById.get(account.entityId)?.name ?? "Unknown Entity",
      accountEntity: entityById.get(account.entityId)?.name ?? "Unknown Entity",
      bank: account.accountName,
      maskedAccountNo: maskedAccountId(account.id),
      fundType: sourceLabel(account.latestBalance?.source ?? account.source),
      currency: account.latestBalance?.currency || account.currency || "Unspecified",
      defaultActive: true,
      statementMatchingNotes: account.latestBalance?.source === "xero" ? "Updated through Xero bank ledger sync." : "Updated through ledger data.",
    })),
    statementUploads: {
      columns: ["Month End", "Bank", "Entity / Account", "Statement Period", "Statement File / Link", "Status", "Populated At", "Notes"],
      rows: [],
    },
    fxRates: makeFxRates(accountsWithBalances, fallbackRates),
    dataQualityIssues: payload.dataQualityIssues ?? [],
  };
}
