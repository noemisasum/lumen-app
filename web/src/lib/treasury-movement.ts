export type TreasuryTransferTransaction = {
  id: string;
  bankAccountId: string;
  transactionDate: string;
  signedAmount: number;
  signedAmountUsd: number | null;
  currency: string;
};

function transactionUsdAmount(transaction: TreasuryTransferTransaction) {
  if (transaction.signedAmountUsd !== null) return transaction.signedAmountUsd;
  return transaction.currency === "USD" ? transaction.signedAmount : null;
}

function transactionDateTime(transaction: TreasuryTransferTransaction) {
  return new Date(`${transaction.transactionDate.slice(0, 10)}T00:00:00Z`).getTime();
}

export function estimateInternalTransferEliminations(transactions: TreasuryTransferTransaction[]) {
  const inflows = transactions
    .map((transaction) => ({ transaction, amountUsd: transactionUsdAmount(transaction) }))
    .filter((row): row is { transaction: TreasuryTransferTransaction; amountUsd: number } => row.amountUsd !== null && row.amountUsd > 0)
    .sort((left, right) => Math.abs(right.amountUsd) - Math.abs(left.amountUsd));
  const outflows = transactions
    .map((transaction) => ({ transaction, amountUsd: transactionUsdAmount(transaction) }))
    .filter((row): row is { transaction: TreasuryTransferTransaction; amountUsd: number } => row.amountUsd !== null && row.amountUsd < 0)
    .sort((left, right) => Math.abs(right.amountUsd) - Math.abs(left.amountUsd));
  const usedInflows = new Set<string>();
  let eliminatedUsd = 0;
  let pairedTransactionCount = 0;

  for (const outflow of outflows) {
    const outflowAbs = Math.abs(outflow.amountUsd);
    let bestMatch: { id: string; amountUsd: number; score: number } | null = null;

    for (const inflow of inflows) {
      if (usedInflows.has(inflow.transaction.id) || inflow.transaction.bankAccountId === outflow.transaction.bankAccountId) continue;

      const amountDelta = Math.abs(inflow.amountUsd - outflowAbs);
      const tolerance = Math.max(1, outflowAbs * 0.0025);
      if (amountDelta > tolerance) continue;

      const daysApart = Math.abs(transactionDateTime(inflow.transaction) - transactionDateTime(outflow.transaction)) / 86_400_000;
      if (daysApart > 3) continue;

      const score = amountDelta + daysApart * 10;
      if (!bestMatch || score < bestMatch.score) {
        bestMatch = { id: inflow.transaction.id, amountUsd: inflow.amountUsd, score };
      }
    }

    if (!bestMatch) continue;

    usedInflows.add(bestMatch.id);
    eliminatedUsd += Math.min(outflowAbs, bestMatch.amountUsd);
    pairedTransactionCount += 2;
  }

  return {
    eliminatedUsd: Math.round(eliminatedUsd * 100) / 100,
    pairedTransactionCount,
  };
}
