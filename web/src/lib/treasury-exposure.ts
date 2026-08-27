export type TreasuryExposureRow = {
  id: string;
  label: string;
  detail: string;
  amountUsd: number;
  comparisonAmountUsd?: number;
  accountCount: number;
};

export const BANK_EXPOSURE_THRESHOLD_USD = 250_000;

function formatUsdCompact(amount: number) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  })
    .format(amount)
    .replace("$", "US$");
}

export function groupSmallBankExposureRows(rows: TreasuryExposureRow[]) {
  const visibleRows = rows.filter((row) => Math.abs(row.amountUsd) > BANK_EXPOSURE_THRESHOLD_USD);
  const smallerRows = rows.filter((row) => Math.abs(row.amountUsd) <= BANK_EXPOSURE_THRESHOLD_USD);
  if (!smallerRows.length) return visibleRows;

  const otherAmountUsd = smallerRows.reduce((total, row) => total + row.amountUsd, 0);
  const hasComparisonAmounts = smallerRows.some((row) => row.comparisonAmountUsd !== undefined);
  const otherComparisonAmountUsd = hasComparisonAmounts ? smallerRows.reduce((total, row) => total + (row.comparisonAmountUsd ?? 0), 0) : undefined;
  const relationshipLabel = smallerRows.length === 1 ? "banking relationship" : "banking relationships";
  visibleRows.push({
    id: "__other_banks",
    label: "Other Banks",
    detail: `${smallerRows.length} ${relationshipLabel} below US$250k, ${formatUsdCompact(otherAmountUsd)} total`,
    amountUsd: otherAmountUsd,
    ...(otherComparisonAmountUsd === undefined ? {} : { comparisonAmountUsd: otherComparisonAmountUsd }),
    accountCount: smallerRows.reduce((total, row) => total + row.accountCount, 0),
  });

  return visibleRows.sort((left, right) => {
    if (left.id === "__other_banks") return 1;
    if (right.id === "__other_banks") return -1;
    return Math.abs(right.amountUsd) - Math.abs(left.amountUsd);
  });
}

export function withComparisonExposureAmounts(rows: TreasuryExposureRow[], comparisonRows: TreasuryExposureRow[]) {
  const comparisonAmountById = new Map(comparisonRows.map((row) => [row.id, row.amountUsd]));
  return rows.map((row) => ({
    ...row,
    comparisonAmountUsd: comparisonAmountById.get(row.id) ?? 0,
  }));
}
