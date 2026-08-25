import type {
  BankBalanceWorkbookData,
  CountrySummaryRow,
  FxRateRow,
  LicenseSummaryRow,
  MonthlyBalanceRow,
} from "./types";

export type BalanceFilters = {
  country: string;
  fundType: string;
  currency: string;
  search: string;
};

export type BalanceSortKey = "balanceUsd" | "movementUsd" | "movementPct" | "country" | "bank";

export type CurrencyExposureRow = {
  currency: string;
  balanceUsd: number;
  balanceLocal: number;
  accountCount: number;
};

export type FundTypeSplitRow = {
  fundType: string;
  balanceUsd: number;
  accountCount: number;
  shareOfTotal: number;
};

export type StatementReadiness = {
  readyAccounts: number;
  mappedAccounts: number;
  unmappedAccounts: number;
  activeMappings: number;
  uploadRows: number;
};

export function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

export function filterBalances(rows: MonthlyBalanceRow[], filters: BalanceFilters) {
  const search = filters.search.trim().toLowerCase();

  return rows.filter((row) => {
    if (filters.country && row.country !== filters.country) return false;
    if (filters.fundType && row.fundType !== filters.fundType) return false;
    if (filters.currency && row.currency !== filters.currency) return false;
    if (!search) return true;

    return [row.accountEntity, row.bank, row.country, row.currency, row.fundType, row.sourceWorkbook]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
}

export function sortBalances(rows: MonthlyBalanceRow[], sortKey: BalanceSortKey) {
  return [...rows].sort((left, right) => {
    if (sortKey === "country") return left.country.localeCompare(right.country) || right.balanceUsd - left.balanceUsd;
    if (sortKey === "bank") return left.bank.localeCompare(right.bank) || right.balanceUsd - left.balanceUsd;
    if (sortKey === "movementPct") return Math.abs(right.movementPct ?? 0) - Math.abs(left.movementPct ?? 0);
    return Math.abs(right[sortKey]) - Math.abs(left[sortKey]);
  });
}

export function sumUsd(rows: Array<{ balanceUsd: number }>) {
  return rows.reduce((total, row) => total + row.balanceUsd, 0);
}

export function groupCurrencyExposure(rows: MonthlyBalanceRow[]): CurrencyExposureRow[] {
  const grouped = new Map<string, CurrencyExposureRow>();

  for (const row of rows) {
    const current = grouped.get(row.currency) ?? { currency: row.currency, balanceUsd: 0, balanceLocal: 0, accountCount: 0 };
    current.balanceUsd += row.balanceUsd;
    current.balanceLocal += row.balanceLocal;
    current.accountCount += 1;
    grouped.set(row.currency, current);
  }

  return Array.from(grouped.values()).sort((left, right) => Math.abs(right.balanceUsd) - Math.abs(left.balanceUsd));
}

export function groupFundTypes(rows: MonthlyBalanceRow[], totalUsd: number): FundTypeSplitRow[] {
  const grouped = new Map<string, Omit<FundTypeSplitRow, "shareOfTotal">>();

  for (const row of rows) {
    const current = grouped.get(row.fundType) ?? { fundType: row.fundType, balanceUsd: 0, accountCount: 0 };
    current.balanceUsd += row.balanceUsd;
    current.accountCount += 1;
    grouped.set(row.fundType, current);
  }

  return Array.from(grouped.values())
    .map((row) => ({ ...row, shareOfTotal: totalUsd ? row.balanceUsd / totalUsd : 0 }))
    .sort((left, right) => Math.abs(right.balanceUsd) - Math.abs(left.balanceUsd));
}

export function getLargestCountryMovement(rows: CountrySummaryRow[]) {
  return [...rows].sort((left, right) => Math.abs(right.movementUsd) - Math.abs(left.movementUsd))[0] ?? null;
}

export function getLargestLicenseSplit(rows: LicenseSummaryRow[]) {
  return [...rows].sort((left, right) => right.totalUsd - left.totalUsd)[0] ?? null;
}

export function statementReadiness(data: Pick<BankBalanceWorkbookData, "bankMapping" | "statementUploads">): StatementReadiness {
  const activeMappings = data.bankMapping.filter((row) => row.defaultActive).length;
  const mappedAccounts = data.bankMapping.length;

  return {
    readyAccounts: activeMappings,
    mappedAccounts,
    unmappedAccounts: Math.max(0, mappedAccounts - activeMappings),
    activeMappings,
    uploadRows: data.statementUploads.rows.length,
  };
}

export function usedFxRates(rates: FxRateRow[], balances: MonthlyBalanceRow[]) {
  const usedCurrencies = new Set(balances.map((row) => row.currency));
  return rates.filter((rate) => usedCurrencies.has(rate.currency));
}

export function percentOf(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total === 0) return 0;
  return Math.max(0, Math.min(100, Math.abs(value / total) * 100));
}

export function normalizeStatementStatus(value: number) {
  if (value === 0) return "Ready for first upload";
  if (value === 1) return "1 upload staged";
  return `${value} uploads staged`;
}

export function formatUploadCoverage(readiness: StatementReadiness) {
  if (!readiness.mappedAccounts) return "No accounts mapped";
  return `${readiness.activeMappings}/${readiness.mappedAccounts} mapped accounts active`;
}
