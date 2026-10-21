/** Aggregate recorded USD estimates, never infer external flows from coincident amounts. */
export function summarizeRecordedMovements(rows: Array<{
  transactionCount: number;
  usdConvertibleTransactionCount: number;
  usdInflow: number;
  usdOutflow: number;
  usdNet: number;
}>) {
  const totals = rows.reduce((sum, row) => ({
    count: sum.count + row.transactionCount,
    converted: sum.converted + row.usdConvertibleTransactionCount,
    usdInflow: sum.usdInflow + row.usdInflow,
    usdOutflow: sum.usdOutflow + row.usdOutflow,
    usdNet: sum.usdNet + row.usdNet,
  }), { count: 0, converted: 0, usdInflow: 0, usdOutflow: 0, usdNet: 0 });
  // Match ledger monetary precision before sign classification; discard signed zero.
  totals.usdInflow = Math.round(totals.usdInflow * 100) / 100 || 0;
  totals.usdOutflow = Math.round(totals.usdOutflow * 100) / 100 || 0;
  totals.usdNet = Math.round(totals.usdNet * 100) / 100 || 0;
  const headline = !totals.count ? "No Recorded Movements"
    : !totals.converted ? "USD Estimate Unavailable"
    : totals.usdNet > 0 ? "Net Recorded Inflow"
    : totals.usdNet < 0 ? "Net Recorded Outflow" : "Zero Net Recorded Movement";
  return { ...totals, headline, partial: totals.converted < totals.count };
}
