export type LedgerSource = "manual" | "xero" | "bank_feed";

export type LedgerDashboardEntity = {
  id: string;
  name: string;
  code: string | null;
  orgId: string;
};

export type LedgerDashboardAccount = {
  id: string;
  entityId: string;
  accountName: string;
  currency: string | null;
  status: string;
  source: LedgerSource;
  accountType: LedgerAccountType;
  canAdmin: boolean;
};

export type LedgerAccountType = "bank" | "money_processor";

export type LedgerDashboardBalance = {
  id: string;
  entityId: string;
  bankAccountId: string;
  source: LedgerSource;
  balanceDate: string;
  asOf: string;
  balanceType: string;
  amount: string | number;
  currency: string;
};

export type LedgerUsdConversion = {
  amount: number;
  rate: number;
  rateDate: string;
  asOf: string;
  source: string;
};

export type LedgerDataQualityIssue = {
  code: "invalid_balance_currency" | "missing_usd_rate";
  severity: "warning";
  message: string;
  entityId: string;
  bankAccountId: string;
  balanceId?: string;
  currency: string;
};

export type LedgerDashboardTransaction = {
  id: string;
  entityId: string;
  bankAccountId: string;
  source: LedgerSource;
  transactionDate: string;
  description: string;
  signedAmount: string | number;
  amount: string | number;
  direction: "inflow" | "outflow" | "unknown";
  currency: string;
  status: string;
};

export type LedgerMoneyGroup = {
  currency: string;
  amount: number;
  accountCount: number;
};

export type LedgerSourceMoneyGroup = LedgerMoneyGroup & {
  source: LedgerSource;
};

export type LedgerEntityMoneyGroup = LedgerMoneyGroup & {
  entityId: string;
  entityName: string;
};

export type LedgerTransactionBreakdown = {
  currency: string;
  source: LedgerSource;
  inflow: number;
  outflow: number;
  net: number;
  transactionCount: number;
};

export type LedgerDashboardLatestBalance = {
  amount: number;
  currency: string;
  originalCurrency: string;
  source: LedgerSource;
  balanceDate: string;
  asOf: string;
  balanceType: string;
  usdConversion: LedgerUsdConversion | null;
};

export type LedgerDashboardRecentTransaction = {
  id: string;
  entityId: string;
  bankAccountId: string;
  accountName: string;
  entityName: string;
  source: LedgerSource;
  accountType: LedgerAccountType;
  transactionDate: string;
  description: string;
  signedAmount: number;
  direction: "inflow" | "outflow" | "unknown";
  currency: string;
  status: string;
};

export type LedgerDashboardPayload = {
  asOf: string;
  windowDays: number;
  entities: LedgerDashboardEntity[];
  accounts: Array<LedgerDashboardAccount & { latestBalance: LedgerDashboardLatestBalance | null }>;
  totalsByCurrency: LedgerMoneyGroup[];
  totalsBySource: LedgerSourceMoneyGroup[];
  balancesByEntity: LedgerEntityMoneyGroup[];
  transactionBreakdowns: LedgerTransactionBreakdown[];
  recentTransactions: LedgerDashboardRecentTransaction[];
  dataQualityIssues: LedgerDataQualityIssue[];
  fx: {
    enabled: boolean;
    status: "available" | "missing_credentials" | "schema_missing" | "fetch_failed";
    source: "xe";
    missingCurrencies: string[];
  };
};

type GroupValue = {
  amount: number;
  accountIds: Set<string>;
};

const moneyProcessorAccountNamePattern =
  /\b(adyen|airwallex|alipay|braintree|checkout\.com|neteller|paypal|payoneer|razorpay|skrill|square|stripe|wise|worldpay|wechat\s+pay)\b/;

const balanceTypeRank: Record<string, number> = {
  closing: 6,
  current: 5,
  available: 4,
  reported: 3,
  statement: 2,
  opening: 1,
};

function numberValue(value: string | number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDashboardCurrency(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase() ?? "";
  if (normalized === "CNH") return normalized;
  return /^[A-Z]{3}$/.test(normalized) && Intl.supportedValuesOf("currency").includes(normalized) ? normalized : null;
}

export function classifyLedgerAccountType(input: { accountType?: LedgerAccountType | null; accountName: string }): LedgerAccountType {
  if (input.accountType === "money_processor" || input.accountType === "bank") return input.accountType;
  return moneyProcessorAccountNamePattern.test(input.accountName.toLowerCase()) ? "money_processor" : "bank";
}

export function isMissingLedgerAccountTypeColumnError(error: unknown) {
  const maybeError = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown } | null;
  const code = typeof maybeError?.code === "string" ? maybeError.code : "";
  const text = [maybeError?.message, maybeError?.details, maybeError?.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return text.includes("account_type") && (code === "42703" || code === "PGRST204" || text.includes("schema cache") || text.includes("does not exist"));
}

function displayCurrency(primary: string | null | undefined, fallback: string | null | undefined) {
  const rawPrimary = primary?.trim();
  if (rawPrimary) return normalizeDashboardCurrency(rawPrimary) ?? "Unspecified";
  return normalizeDashboardCurrency(fallback) ?? "Unspecified";
}

function compareIsoDesc(left: string | null | undefined, right: string | null | undefined) {
  return String(right ?? "").localeCompare(String(left ?? ""));
}

function compareBalances(left: LedgerDashboardBalance, right: LedgerDashboardBalance) {
  const dateCompare = compareIsoDesc(left.balanceDate, right.balanceDate);
  if (dateCompare !== 0) return dateCompare;

  const asOfCompare = compareIsoDesc(left.asOf, right.asOf);
  if (asOfCompare !== 0) return asOfCompare;

  return (balanceTypeRank[right.balanceType] ?? 0) - (balanceTypeRank[left.balanceType] ?? 0);
}

function addMoneyGroup(groups: Map<string, GroupValue>, key: string, amount: number, accountId: string) {
  const existing = groups.get(key) ?? { amount: 0, accountIds: new Set<string>() };
  existing.amount += amount;
  existing.accountIds.add(accountId);
  groups.set(key, existing);
}

function sortedMoneyGroups(groups: Map<string, GroupValue>) {
  return Array.from(groups.entries())
    .map(([currency, value]) => ({
      currency,
      amount: value.amount,
      accountCount: value.accountIds.size,
    }))
    .sort((left, right) => left.currency.localeCompare(right.currency));
}

export function buildLedgerDashboardPayload(input: {
  entities: LedgerDashboardEntity[];
  accounts: LedgerDashboardAccount[];
  balances: LedgerDashboardBalance[];
  transactions: LedgerDashboardTransaction[];
  usdRates?: Map<string, { rateToUsd: number; rateDate: string; asOf: string; source: string; status: string }>;
  fxStatus?: "available" | "missing_credentials" | "schema_missing" | "fetch_failed";
  fxMissingCurrencies?: string[];
  asOf?: string;
  windowDays?: number;
}): LedgerDashboardPayload {
  const asOf = input.asOf ?? new Date().toISOString();
  const windowDays = input.windowDays ?? 30;
  const entityById = new Map(input.entities.map((entity) => [entity.id, entity]));
  const accountById = new Map(input.accounts.map((account) => [account.id, account]));
  const sortedBalances = [...input.balances].sort(compareBalances);
  const latestBalanceByAccountId = new Map<string, LedgerDashboardLatestBalance>();
  const dataQualityIssues: LedgerDataQualityIssue[] = [];
  const fxMissingCurrencies = new Set(input.fxMissingCurrencies ?? []);

  for (const balance of sortedBalances) {
    if (latestBalanceByAccountId.has(balance.bankAccountId)) continue;
    const account = accountById.get(balance.bankAccountId);
    const normalizedBalanceCurrency = normalizeDashboardCurrency(balance.currency);
    const displayedCurrency = displayCurrency(balance.currency, account?.currency);
    const amount = numberValue(balance.amount);
    let usdConversion: LedgerUsdConversion | null = null;

    if (!normalizedBalanceCurrency) {
      const invalidCurrency = balance.currency?.trim().toUpperCase() || "Unspecified";
      dataQualityIssues.push({
        code: "invalid_balance_currency",
        severity: "warning",
        message: `${invalidCurrency} is not a supported ISO currency code for ${account?.accountName ?? "a bank account"} balance.`,
        entityId: balance.entityId,
        bankAccountId: balance.bankAccountId,
        balanceId: balance.id,
        currency: invalidCurrency,
      });
    } else {
      const rate = input.usdRates?.get(normalizedBalanceCurrency);
      if (rate?.status === "available" && Number.isFinite(rate.rateToUsd) && rate.rateToUsd > 0) {
        usdConversion = {
          amount: amount * rate.rateToUsd,
          rate: rate.rateToUsd,
          rateDate: rate.rateDate,
          asOf: rate.asOf,
          source: rate.source,
        };
      } else if (normalizedBalanceCurrency !== "USD") {
        fxMissingCurrencies.add(normalizedBalanceCurrency);
        dataQualityIssues.push({
          code: "missing_usd_rate",
          severity: "warning",
          message: `No cached USD exchange rate is available for ${normalizedBalanceCurrency}.`,
          entityId: balance.entityId,
          bankAccountId: balance.bankAccountId,
          balanceId: balance.id,
          currency: normalizedBalanceCurrency,
        });
      }
    }

    latestBalanceByAccountId.set(balance.bankAccountId, {
      amount,
      currency: displayedCurrency,
      originalCurrency: balance.currency?.trim().toUpperCase() || displayedCurrency,
      source: balance.source,
      balanceDate: balance.balanceDate,
      asOf: balance.asOf,
      balanceType: balance.balanceType,
      usdConversion,
    });
  }

  const totalsByCurrency = new Map<string, GroupValue>();
  const totalsBySource = new Map<string, GroupValue>();
  const balancesByEntity = new Map<string, GroupValue>();

  for (const account of input.accounts) {
    const latestBalance = latestBalanceByAccountId.get(account.id);
    if (!latestBalance) continue;

    addMoneyGroup(totalsByCurrency, latestBalance.currency, latestBalance.amount, account.id);
    addMoneyGroup(totalsBySource, `${latestBalance.source}:${latestBalance.currency}`, latestBalance.amount, account.id);
    addMoneyGroup(balancesByEntity, `${account.entityId}:${latestBalance.currency}`, latestBalance.amount, account.id);
  }

  const transactionBreakdowns = new Map<string, LedgerTransactionBreakdown>();
  for (const transaction of input.transactions) {
    const signedAmount = numberValue(transaction.signedAmount);
    const account = accountById.get(transaction.bankAccountId);
    const currency = displayCurrency(transaction.currency, account?.currency);
    const key = `${transaction.source}:${currency}`;
    const existing =
      transactionBreakdowns.get(key) ??
      ({
        currency,
        source: transaction.source,
        inflow: 0,
        outflow: 0,
        net: 0,
        transactionCount: 0,
      } satisfies LedgerTransactionBreakdown);

    if (signedAmount > 0) existing.inflow += signedAmount;
    if (signedAmount < 0) existing.outflow += Math.abs(signedAmount);
    existing.net += signedAmount;
    existing.transactionCount += 1;
    transactionBreakdowns.set(key, existing);
  }

  const accounts = input.accounts
    .map((account) => ({
      ...account,
      currency: normalizeDashboardCurrency(account.currency),
      latestBalance: latestBalanceByAccountId.get(account.id) ?? null,
    }))
    .sort((left, right) => {
      const leftEntity = entityById.get(left.entityId)?.name ?? "";
      const rightEntity = entityById.get(right.entityId)?.name ?? "";
      return leftEntity.localeCompare(rightEntity) || left.accountName.localeCompare(right.accountName);
    });

  const balancesByEntityRows = Array.from(balancesByEntity.entries())
    .map(([key, value]) => {
      const [entityId, currency] = key.split(":");
      return {
        entityId,
        entityName: entityById.get(entityId)?.name ?? "Unknown Entity",
        currency,
        amount: value.amount,
        accountCount: value.accountIds.size,
      };
    })
    .sort((left, right) => left.entityName.localeCompare(right.entityName) || left.currency.localeCompare(right.currency));

  const totalsBySourceRows = Array.from(totalsBySource.entries())
    .map(([key, value]) => {
      const [source, currency] = key.split(":") as [LedgerSource, string];
      return {
        source,
        currency,
        amount: value.amount,
        accountCount: value.accountIds.size,
      };
    })
    .sort((left, right) => left.source.localeCompare(right.source) || left.currency.localeCompare(right.currency));

  const recentTransactions = [...input.transactions]
    .sort((left, right) => compareIsoDesc(left.transactionDate, right.transactionDate))
    .map((transaction) => {
      const account = accountById.get(transaction.bankAccountId);
      const entity = entityById.get(transaction.entityId);
      return {
        id: transaction.id,
        entityId: transaction.entityId,
        bankAccountId: transaction.bankAccountId,
        accountName: account?.accountName ?? "Unknown Account",
        entityName: entity?.name ?? "Unknown Entity",
        source: transaction.source,
        accountType: account?.accountType ?? "bank",
        transactionDate: transaction.transactionDate,
        description: transaction.description,
        signedAmount: numberValue(transaction.signedAmount),
        direction: transaction.direction,
        currency: displayCurrency(transaction.currency, account?.currency),
        status: transaction.status,
      };
    });

  return {
    asOf,
    windowDays,
    entities: input.entities,
    accounts,
    totalsByCurrency: sortedMoneyGroups(totalsByCurrency),
    totalsBySource: totalsBySourceRows,
    balancesByEntity: balancesByEntityRows,
    transactionBreakdowns: Array.from(transactionBreakdowns.values()).sort(
      (left, right) => left.source.localeCompare(right.source) || left.currency.localeCompare(right.currency),
    ),
    recentTransactions,
    dataQualityIssues,
    fx: {
      enabled: input.fxStatus === "available",
      status: input.fxStatus ?? "missing_credentials",
      source: "xe",
      missingCurrencies: Array.from(fxMissingCurrencies).sort(),
    },
  };
}
