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

export type LedgerDashboardData = {
  asOf: string;
  entities: Array<{ id: string; name: string; code: string | null; orgId: string }>;
  accounts: LedgerAccount[];
  totalsBySource: Array<{ source: LedgerSource; currency: string; amount: number; accountCount: number }>;
};

function sourceLabel(source: LedgerSource) {
  if (source === "xero") return "Xero";
  if (source === "bank_feed") return "Bank Feed";
  return "Manual";
}

function balanceUsd(account: LedgerAccount) {
  const balance = account.latestBalance;
  if (!balance) return 0;
  if (balance.usdConversion) return balance.usdConversion.amount;
  return balance.currency === "USD" ? balance.amount : 0;
}

function movementPct(current: number, prior: number) {
  return prior ? (current - prior) / Math.abs(prior) : null;
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
  const totalUsd = accountsWithBalances.reduce((total, account) => total + balanceUsd(account), 0);
  const currencies = new Set(accountsWithBalances.map((account) => account.latestBalance?.currency || account.currency || "Unspecified"));
  const selectedMonth = accountsWithBalances
    .map((account) => account.latestBalance?.balanceDate)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0];

  const monthlyBalances = accountsWithBalances.map((account) => {
    const latest = account.latestBalance;
    const currentUsd = balanceUsd(account);
    const currency = latest?.currency || account.currency || "Unspecified";

    return {
      monthEnd: latest?.balanceDate ?? selectedMonth ?? payload.asOf.slice(0, 10),
      country: entityById.get(account.entityId)?.name ?? "Unknown Entity",
      accountEntity: entityById.get(account.entityId)?.name ?? "Unknown Entity",
      bank: account.accountName,
      maskedAccountNo: maskedAccountId(account.id),
      fundType: sourceLabel(latest?.source ?? account.source),
      currency,
      fxUnitsPerUsd: latest?.usdConversion?.rate ? 1 / latest.usdConversion.rate : 1,
      balanceLocal: latest?.amount ?? 0,
      balanceUsd: currentUsd,
      priorMonthUsd: currentUsd,
      movementUsd: 0,
      movementPct: movementPct(currentUsd, currentUsd),
      sourceWorkbook: `${sourceLabel(latest?.source ?? account.source)} ledger`,
      statementFileRef: null,
      notes: latest?.asOf ? `Balance as of ${latest.asOf}` : null,
    };
  });

  const countrySummary = Array.from(
    monthlyBalances.reduce((groups, row) => {
      const current = groups.get(row.country) ?? { country: row.country, priorMonthUsd: 0, currentMonthUsd: 0, movementUsd: 0, movementPct: null as number | null };
      current.currentMonthUsd += row.balanceUsd;
      current.priorMonthUsd += row.priorMonthUsd;
      current.movementUsd += row.movementUsd;
      current.movementPct = movementPct(current.currentMonthUsd, current.priorMonthUsd);
      groups.set(row.country, current);
      return groups;
    }, new Map<string, { country: string; priorMonthUsd: number; currentMonthUsd: number; movementUsd: number; movementPct: number | null }>()),
  ).map(([, row]) => ({ ...row, movementPct: row.movementPct ?? 0 }));

  const licenseSummary = Array.from(
    monthlyBalances.reduce((groups, row) => {
      const current = groups.get(row.fundType) ?? { license: row.fundType, clientFundsUsd: 0, corporateFundsUsd: 0, totalUsd: 0 };
      current.totalUsd += row.balanceUsd;
      if (row.fundType === "Xero") current.clientFundsUsd += row.balanceUsd;
      else current.corporateFundsUsd += row.balanceUsd;
      groups.set(row.fundType, current);
      return groups;
    }, new Map<string, { license: string; clientFundsUsd: number; corporateFundsUsd: number; totalUsd: number }>()),
  ).map(([, row]) => row);

  const topBanks = [...monthlyBalances]
    .sort((left, right) => Math.abs(right.balanceUsd) - Math.abs(left.balanceUsd))
    .slice(0, 10)
    .map((row) => ({ bank: row.bank, totalUsd: row.balanceUsd, movementUsd: row.movementUsd }));

  const concentration = monthlyBalances.map((row) => {
    const share = totalUsd ? Math.abs(row.balanceUsd / totalUsd) : 0;
    return {
      entityGroup: row.accountEntity,
      bank: row.bank,
      totalUsd: row.balanceUsd,
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
      priorMonthUsd: totalUsd,
      movementUsd: 0,
      movementPct: 0,
      accounts: accountsWithBalances.length,
      currencies: currencies.size,
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
  };
}
