import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildLedgerDashboardPayload, classifyLedgerAccountType, isMissingLedgerAccountTypeColumnError, shouldExcludeLedgerAccount } from "../src/lib/server/ledger-dashboard.ts";
import { getUsdRatesForCurrencies } from "../src/lib/server/fx-rates.ts";
import { estimateInternalTransferEliminations } from "../src/lib/treasury-movement.ts";

function createFxSupabaseStub({ cachedRows = [], upsertError = null } = {}) {
  const upserts = [];
  return {
    upserts,
    from(table) {
      assert.equal(table, "fx_exchange_rates");
      let orderCount = 0;
      return {
        select() {
          return this;
        },
        in() {
          return this;
        },
        eq() {
          return this;
        },
        order() {
          orderCount += 1;
          return orderCount >= 2 ? Promise.resolve({ data: cachedRows, error: null }) : this;
        },
        upsert(row, options) {
          upserts.push({ row, options });
          return Promise.resolve({ error: upsertError });
        },
      };
    },
  };
}

const payload = buildLedgerDashboardPayload({
  asOf: "2026-08-22T00:00:00.000Z",
  windowDays: 30,
  entities: [
    { id: "entity-a", orgId: "org-1", name: "Lumen HK", code: "HK" },
    { id: "entity-b", orgId: "org-1", name: "Lumen US", code: "US" },
  ],
  accounts: [
    { id: "account-hkd", entityId: "entity-a", accountName: "HSBC Current", currency: "HKD", status: "active", source: "manual", accountType: "operating_bank", canAdmin: true },
    { id: "account-usd", entityId: "entity-b", accountName: "Mercury USD", currency: "USD", status: "active", source: "xero", accountType: "operating_bank", canAdmin: true },
    { id: "account-paypal", entityId: "entity-b", accountName: "MP: PayPal USD", currency: "USD", status: "active", source: "manual", accountType: classifyLedgerAccountType({ accountName: "MP: PayPal USD", accountType: null }), canAdmin: true },
  ],
  balances: [
    {
      id: "old-hkd",
      entityId: "entity-a",
      bankAccountId: "account-hkd",
      source: "manual",
      balanceDate: "2026-08-01",
      asOf: "2026-08-01T10:00:00.000Z",
      balanceType: "closing",
      amount: "100.00",
      currency: "HKD",
    },
    {
      id: "latest-hkd",
      entityId: "entity-a",
      bankAccountId: "account-hkd",
      source: "manual",
      balanceDate: "2026-08-20",
      asOf: "2026-08-20T10:00:00.000Z",
      balanceType: "closing",
      amount: "250.50",
      currency: "HKD",
    },
    {
      id: "latest-usd",
      entityId: "entity-b",
      bankAccountId: "account-usd",
      source: "xero",
      balanceDate: "2026-08-20",
      asOf: "2026-08-20T10:00:00.000Z",
      balanceType: "reported",
      amount: 40,
      currency: "USD",
    },
    {
      id: "latest-paypal",
      entityId: "entity-b",
      bankAccountId: "account-paypal",
      source: "manual",
      balanceDate: "2026-08-20",
      asOf: "2026-08-20T10:00:00.000Z",
      balanceType: "closing",
      amount: "300.00",
      currency: "USD",
    },
  ],
  transactions: [
    {
      id: "txn-in",
      entityId: "entity-a",
      bankAccountId: "account-hkd",
      source: "manual",
      transactionDate: "2026-08-21",
      description: "Customer receipt",
      signedAmount: "75.25",
      amount: "75.25",
      direction: "inflow",
      currency: "HKD",
      status: "posted",
    },
    {
      id: "txn-out",
      entityId: "entity-a",
      bankAccountId: "account-hkd",
      source: "manual",
      transactionDate: "2026-08-20",
      description: "Vendor payment",
      signedAmount: "-25.00",
      amount: "25.00",
      direction: "outflow",
      currency: "HKD",
      status: "posted",
    },
    {
      id: "txn-usd",
      entityId: "entity-b",
      bankAccountId: "account-usd",
      source: "xero",
      transactionDate: "2026-08-19",
      description: "Xero bank transaction",
      signedAmount: 10,
      amount: 10,
      direction: "inflow",
      currency: "USD",
      status: "reconciled",
    },
    {
      id: "txn-paypal",
      entityId: "entity-b",
      bankAccountId: "account-paypal",
      source: "manual",
      transactionDate: "2026-08-18",
      description: "Processor payout",
      signedAmount: 300,
      amount: 300,
      direction: "inflow",
      currency: "USD",
      status: "posted",
    },
  ],
  usdRates: new Map([
    ["HKD", { rateToUsd: 0.128, rateDate: "2026-08-20", asOf: "2026-08-20T12:00:00.000Z", source: "xe", status: "available" }],
    ["USD", { rateToUsd: 1, rateDate: "2026-08-20", asOf: "2026-08-20T12:00:00.000Z", source: "identity", status: "available" }],
  ]),
  fxStatus: "available",
});

assert.equal(payload.accounts.find((account) => account.id === "account-hkd")?.latestBalance?.amount, 250.5);
assert.equal(payload.accounts.find((account) => account.id === "account-hkd")?.latestBalance?.usdConversion?.amount, 32.064);
assert.equal(payload.recentTransactions.find((transaction) => transaction.id === "txn-in")?.signedAmountUsd, 9.63);
assert.equal(payload.accounts.find((account) => account.id === "account-paypal")?.accountType, "money_processor");
assert.equal(classifyLedgerAccountType({ accountName: "Operating Account", accountType: null }), "operating_bank");
assert.equal(classifyLedgerAccountType({ accountName: "Client Money Account", accountType: null }), "client_money");
assert.equal(classifyLedgerAccountType({ accountName: "MP: Stripe USD", accountType: null }), "money_processor");
assert.equal(classifyLedgerAccountType({ accountName: "LP: Prime Broker USD", accountType: null }), "liquidity_provider");
assert.equal(classifyLedgerAccountType({ accountName: "MP: Legacy Processor", accountType: "operating_bank" }), "money_processor");
assert.equal(classifyLedgerAccountType({ accountName: "LP: Legacy Provider", accountType: "operating_bank" }), "liquidity_provider");
assert.equal(classifyLedgerAccountType({ accountName: "UOB USD Bank Account (Client funds)", accountType: "operating_bank" }), "client_money");
assert.equal(classifyLedgerAccountType({ accountName: "EX Open Position AUD", accountType: "operating_bank" }), "operating_bank");
assert.equal(classifyLedgerAccountType({ accountName: "Legacy Bank", accountType: "bank" }), "operating_bank");
assert.equal(shouldExcludeLedgerAccount({ accountName: "EX Client Liability" }), true);
assert.equal(shouldExcludeLedgerAccount({ accountName: "EX Client Trust Liability AUD" }), true);
assert.equal(shouldExcludeLedgerAccount({ accountName: "EX Client Trust Liability USD" }), true);
assert.equal(shouldExcludeLedgerAccount({ accountName: "Client Trust Liability Bal USD (MT4)" }), true);
assert.equal(shouldExcludeLedgerAccount({ accountName: "EX Client Liabiltiy" }), true);
assert.equal(shouldExcludeLedgerAccount({ accountName: "EX Open Position AUD" }), true);
assert.equal(shouldExcludeLedgerAccount({ accountName: "EX Open Positions USD" }), true);
assert.equal(shouldExcludeLedgerAccount({ accountName: "PayPal Clearing" }), true);
assert.equal(shouldExcludeLedgerAccount({ accountName: "Client Money Account" }), false);
assert.equal(shouldExcludeLedgerAccount({ accountName: "Operating Liability Insurance" }), false);
assert.equal(isMissingLedgerAccountTypeColumnError({ code: "PGRST204", message: "Could not find the 'account_type' column of 'entity_bank_accounts' in the schema cache" }), true);
assert.equal(isMissingLedgerAccountTypeColumnError({ code: "42501", message: "permission denied for table entity_bank_accounts" }), false);
assert.deepEqual(payload.totalsByCurrency, [
  { currency: "HKD", amount: 250.5, accountCount: 1 },
  { currency: "USD", amount: 340, accountCount: 2 },
]);
assert.deepEqual(payload.totalsBySource, [
  { source: "manual", currency: "HKD", amount: 250.5, accountCount: 1 },
  { source: "manual", currency: "USD", amount: 300, accountCount: 1 },
  { source: "xero", currency: "USD", amount: 40, accountCount: 1 },
]);
assert.deepEqual(payload.totalsByAccountType, [
  { accountType: "money_processor", currency: "USD", amount: 300, accountCount: 1 },
  { accountType: "operating_bank", currency: "HKD", amount: 250.5, accountCount: 1 },
  { accountType: "operating_bank", currency: "USD", amount: 40, accountCount: 1 },
]);
assert.deepEqual(payload.transactionBreakdowns, [
  { source: "manual", currency: "HKD", inflow: 75.25, outflow: 25, net: 50.25, usdInflow: 9.63, usdOutflow: 3.2, usdNet: 6.43, usdConvertibleTransactionCount: 2, transactionCount: 2 },
  { source: "manual", currency: "USD", inflow: 300, outflow: 0, net: 300, usdInflow: 300, usdOutflow: 0, usdNet: 300, usdConvertibleTransactionCount: 1, transactionCount: 1 },
  { source: "xero", currency: "USD", inflow: 10, outflow: 0, net: 10, usdInflow: 10, usdOutflow: 0, usdNet: 10, usdConvertibleTransactionCount: 1, transactionCount: 1 },
]);
assert.deepEqual(
  estimateInternalTransferEliminations([
    { id: "transfer-out", bankAccountId: "account-hkd", transactionDate: "2026-08-21", signedAmount: -100, signedAmountUsd: -100, currency: "USD" },
    { id: "transfer-in", bankAccountId: "account-usd", transactionDate: "2026-08-22", signedAmount: 100, signedAmountUsd: 100, currency: "USD" },
    { id: "vendor-out", bankAccountId: "account-hkd", transactionDate: "2026-08-21", signedAmount: -100, signedAmountUsd: -100, currency: "USD" },
    { id: "same-account-in", bankAccountId: "account-hkd", transactionDate: "2026-08-21", signedAmount: 100, signedAmountUsd: 100, currency: "USD" },
    { id: "late-in", bankAccountId: "account-usd", transactionDate: "2026-08-29", signedAmount: 100, signedAmountUsd: 100, currency: "USD" },
  ]),
  { eliminatedUsd: 100, pairedTransactionCount: 2 },
);
assert.deepEqual(
  estimateInternalTransferEliminations([
    { id: "tolerance-out", bankAccountId: "account-hkd", transactionDate: "2026-08-21", signedAmount: -1000, signedAmountUsd: -1000, currency: "USD" },
    { id: "tolerance-in", bankAccountId: "account-usd", transactionDate: "2026-08-23", signedAmount: 1002, signedAmountUsd: 1002, currency: "USD" },
    { id: "duplicate-in", bankAccountId: "account-paypal", transactionDate: "2026-08-23", signedAmount: 1002, signedAmountUsd: 1002, currency: "USD" },
  ]),
  { eliminatedUsd: 1000, pairedTransactionCount: 2 },
);
assert.deepEqual(
  estimateInternalTransferEliminations([
    { id: "missing-fx-out", bankAccountId: "account-hkd", transactionDate: "2026-08-21", signedAmount: -7800, signedAmountUsd: null, currency: "HKD" },
    { id: "missing-fx-in", bankAccountId: "account-usd", transactionDate: "2026-08-22", signedAmount: 7800, signedAmountUsd: null, currency: "HKD" },
    { id: "external-in", bankAccountId: "account-usd", transactionDate: "2026-08-22", signedAmount: 250, signedAmountUsd: 250, currency: "USD" },
  ]),
  { eliminatedUsd: 0, pairedTransactionCount: 0 },
);

const largeAccounts = Array.from({ length: 5001 }, (_, index) => ({
  id: `large-account-${index}`,
  entityId: "entity-a",
  accountName: `Large Account ${index}`,
  currency: index % 2 === 0 ? "HKD" : "USD",
  status: "active",
  source: "manual",
  accountType: "operating_bank",
  canAdmin: true,
}));

const largeBalances = largeAccounts.flatMap((account, index) => [
  {
    id: `large-balance-${index}`,
    entityId: account.entityId,
    bankAccountId: account.id,
    source: account.source,
    balanceDate: "2026-08-20",
    asOf: "2026-08-20T10:00:00.000Z",
    balanceType: "closing",
    amount: account.currency === "HKD" ? "1.00" : "2.00",
    currency: account.currency,
  },
  {
    id: `large-old-balance-${index}`,
    entityId: account.entityId,
    bankAccountId: account.id,
    source: account.source,
    balanceDate: "2026-08-01",
    asOf: "2026-08-01T10:00:00.000Z",
    balanceType: "closing",
    amount: "9999.00",
    currency: account.currency,
  },
]);

const largeTransactions = Array.from({ length: 1001 }, (_, index) => ({
  id: `large-txn-${index}`,
  entityId: "entity-a",
  bankAccountId: largeAccounts[index % largeAccounts.length].id,
  source: "manual",
  transactionDate: "2026-08-21",
  description: `Large transaction ${index}`,
  signedAmount: index % 2 === 0 ? "1.00" : "-1.00",
  amount: "1.00",
  direction: index % 2 === 0 ? "inflow" : "outflow",
  currency: index % 3 === 0 ? "USD" : "HKD",
  status: "posted",
}));

const largePayload = buildLedgerDashboardPayload({
  asOf: "2026-08-22T00:00:00.000Z",
  windowDays: 30,
  entities: [{ id: "entity-a", orgId: "org-1", name: "Lumen HK", code: "HK" }],
  accounts: largeAccounts,
  balances: largeBalances,
  transactions: largeTransactions,
  usdRates: new Map([
    ["HKD", { rateToUsd: 0.128, rateDate: "2026-08-20", asOf: "2026-08-20T12:00:00.000Z", source: "xe", status: "available" }],
    ["USD", { rateToUsd: 1, rateDate: "2026-08-20", asOf: "2026-08-20T12:00:00.000Z", source: "identity", status: "available" }],
  ]),
  fxStatus: "available",
});

assert.deepEqual(largePayload.totalsByCurrency, [
  { currency: "HKD", amount: 2501, accountCount: 2501 },
  { currency: "USD", amount: 5000, accountCount: 2500 },
]);
assert.deepEqual(largePayload.transactionBreakdowns, [
  { source: "manual", currency: "HKD", inflow: 334, outflow: 333, net: 1, usdInflow: 43.42, usdOutflow: 43.29, usdNet: 0.13, usdConvertibleTransactionCount: 667, transactionCount: 667 },
  { source: "manual", currency: "USD", inflow: 167, outflow: 167, net: 0, usdInflow: 167, usdOutflow: 167, usdNet: 0, usdConvertibleTransactionCount: 334, transactionCount: 334 },
]);

const invalidCurrencyPayload = buildLedgerDashboardPayload({
  asOf: "2026-08-22T00:00:00.000Z",
  windowDays: 30,
  entities: [{ id: "entity-a", orgId: "org-1", name: "Lumen HK", code: "HK" }],
  accounts: [{ id: "account-invalid", entityId: "entity-a", accountName: "Statement Account", currency: "EUR", status: "active", source: "manual", accountType: "operating_bank", canAdmin: true }],
  balances: [
    {
      id: "bad-month-currency",
      entityId: "entity-a",
      bankAccountId: "account-invalid",
      source: "manual",
      balanceDate: "2026-08-20",
      asOf: "2026-08-20T10:00:00.000Z",
      balanceType: "closing",
      amount: 5,
      currency: "AUG",
    },
  ],
  transactions: [],
  usdRates: new Map([
    ["EUR", { rateToUsd: 1.16, rateDate: "2026-08-20", asOf: "2026-08-20T12:00:00.000Z", source: "xe", status: "available" }],
  ]),
  fxStatus: "available",
});

assert.equal(invalidCurrencyPayload.accounts[0].latestBalance?.currency, "Unspecified");
assert.equal(invalidCurrencyPayload.accounts[0].latestBalance?.usdConversion, null);
assert.equal(invalidCurrencyPayload.dataQualityIssues[0]?.currency, "AUG");
assert.deepEqual(invalidCurrencyPayload.totalsByCurrency, [{ currency: "Unspecified", amount: 5, accountCount: 1 }]);

const olderInvalidCurrencyPayload = buildLedgerDashboardPayload({
  asOf: "2026-08-22T00:00:00.000Z",
  windowDays: 30,
  entities: [{ id: "entity-a", orgId: "org-1", name: "Lumen HK", code: "HK" }],
  accounts: [{ id: "account-older-invalid", entityId: "entity-a", accountName: "Statement Account", currency: "EUR", status: "active", source: "manual", accountType: "operating_bank", canAdmin: true }],
  balances: [
    {
      id: "latest-valid-currency",
      entityId: "entity-a",
      bankAccountId: "account-older-invalid",
      source: "manual",
      balanceDate: "2026-08-20",
      asOf: "2026-08-20T10:00:00.000Z",
      balanceType: "closing",
      amount: 10,
      currency: "EUR",
    },
    {
      id: "older-invalid-currency",
      entityId: "entity-a",
      bankAccountId: "account-older-invalid",
      source: "manual",
      balanceDate: "2026-08-01",
      asOf: "2026-08-01T10:00:00.000Z",
      balanceType: "closing",
      amount: 5,
      currency: "AUG",
    },
    {
      id: "older-invalid-currency-duplicate",
      entityId: "entity-a",
      bankAccountId: "account-older-invalid",
      source: "manual",
      balanceDate: "2026-07-01",
      asOf: "2026-07-01T10:00:00.000Z",
      balanceType: "closing",
      amount: 4,
      currency: "AUG",
    },
  ],
  transactions: [],
  usdRates: new Map([["EUR", { rateToUsd: 1.16, rateDate: "2026-08-20", asOf: "2026-08-20T12:00:00.000Z", source: "xe", status: "available" }]]),
  fxStatus: "available",
});

assert.equal(olderInvalidCurrencyPayload.accounts[0].latestBalance?.currency, "EUR");
assert.deepEqual(
  olderInvalidCurrencyPayload.dataQualityIssues.filter((issue) => issue.code === "invalid_balance_currency").map((issue) => issue.currency),
  ["AUG"],
);

const invalidAccountCurrencyPayload = buildLedgerDashboardPayload({
  asOf: "2026-08-22T00:00:00.000Z",
  windowDays: 30,
  entities: [{ id: "entity-a", orgId: "org-1", name: "Lumen HK", code: "HK" }],
  accounts: [{ id: "account-invalid", entityId: "entity-a", accountName: "Statement Account", currency: "AUG", status: "active", source: "manual", accountType: "operating_bank", canAdmin: true }],
  balances: [
    {
      id: "bad-account-currency",
      entityId: "entity-a",
      bankAccountId: "account-invalid",
      source: "manual",
      balanceDate: "2026-08-20",
      asOf: "2026-08-20T10:00:00.000Z",
      balanceType: "closing",
      amount: 5,
      currency: "AUG",
    },
  ],
  transactions: [],
  fxStatus: "missing_credentials",
});

assert.equal(invalidAccountCurrencyPayload.accounts[0].currency, null);
assert.equal(invalidAccountCurrencyPayload.accounts[0].latestBalance?.currency, "Unspecified");

const originalFetch = globalThis.fetch;
const originalFxRateProvider = process.env.FX_RATE_PROVIDER;
const originalFrankfurterApiBaseUrl = process.env.FRANKFURTER_API_BASE_URL;
const originalXeAccountId = process.env.XE_ACCOUNT_ID;
const originalXeApiKey = process.env.XE_API_KEY;

try {
  delete process.env.FX_RATE_PROVIDER;
  delete process.env.XE_ACCOUNT_ID;
  delete process.env.XE_API_KEY;
  process.env.FRANKFURTER_API_BASE_URL = "https://frankfurter.test/v2";
  const fetchedUrls = [];
  globalThis.fetch = async (url) => {
    fetchedUrls.push(String(url));
    return {
      ok: true,
      json: async () => ({
        base: "HKD",
        quote: "USD",
        rate: 0.128,
        date: "2026-08-20",
      }),
    };
  };

  const fxSupabase = createFxSupabaseStub();
  const frankfurterRates = await getUsdRatesForCurrencies(fxSupabase, ["HKD", "USD", "hkd"]);
  assert.equal(frankfurterRates.status, "available");
  assert.equal(frankfurterRates.source, "frankfurter");
  assert.equal(frankfurterRates.rates.get("HKD")?.source, "frankfurter");
  assert.equal(frankfurterRates.rates.get("HKD")?.rateToUsd, 0.128);
  assert.deepEqual(fetchedUrls, ["https://frankfurter.test/v2/rate/HKD/USD"]);
  assert.equal(fxSupabase.upserts[0]?.row.source, "frankfurter");
  assert.equal(fxSupabase.upserts[0]?.options.onConflict, "base_currency,quote_currency,rate_date,source");

  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({ message: "unavailable" }) });
  const failedFrankfurterRates = await getUsdRatesForCurrencies(createFxSupabaseStub(), ["EUR"]);
  assert.equal(failedFrankfurterRates.status, "fetch_failed");
  assert.equal(failedFrankfurterRates.source, "frankfurter");
  assert.equal(failedFrankfurterRates.rates.get("EUR")?.status, "fetch_failed");
  assert.deepEqual(failedFrankfurterRates.missingCurrencies, ["EUR"]);

  process.env.FX_RATE_PROVIDER = "xe";
  const xeMissingCredentialsRates = await getUsdRatesForCurrencies(createFxSupabaseStub(), ["EUR"]);
  assert.equal(xeMissingCredentialsRates.status, "missing_credentials");
  assert.equal(xeMissingCredentialsRates.source, "xe");
} finally {
  globalThis.fetch = originalFetch;
  if (originalFxRateProvider === undefined) delete process.env.FX_RATE_PROVIDER;
  else process.env.FX_RATE_PROVIDER = originalFxRateProvider;
  if (originalFrankfurterApiBaseUrl === undefined) delete process.env.FRANKFURTER_API_BASE_URL;
  else process.env.FRANKFURTER_API_BASE_URL = originalFrankfurterApiBaseUrl;
  if (originalXeAccountId === undefined) delete process.env.XE_ACCOUNT_ID;
  else process.env.XE_ACCOUNT_ID = originalXeAccountId;
  if (originalXeApiKey === undefined) delete process.env.XE_API_KEY;
  else process.env.XE_API_KEY = originalXeApiKey;
}

const dashboardSource = readFileSync(new URL("../src/app/dashboard/page.tsx", import.meta.url), "utf8");
const dashboardRouteSource = readFileSync(new URL("../src/app/api/dashboard/ledger/route.ts", import.meta.url), "utf8");
const xeroLedgerSource = readFileSync(new URL("../src/lib/server/xero-bank-ledger.ts", import.meta.url), "utf8");
const entityAccountRouteSource = readFileSync(new URL("../src/app/api/entity-bank-accounts/route.ts", import.meta.url), "utf8");
assert.match(dashboardSource, /Treasury Dashboard/);
assert.match(dashboardSource, /Monitor cash positions, account balances, liquidity, and recent ledger movement from authenticated treasury data\./);
assert.match(dashboardSource, /<p className="text-xs leading-5 text-zinc-500 sm:text-right">/);
assert.match(dashboardSource, /function LiquidityMixCard/);
assert.match(dashboardSource, /Donut chart of USD liquidity\. \$\{displayRows/);
assert.match(dashboardSource, /formatUsdCompact/);
assert.match(dashboardSource, /USD balance distribution by treasury account type/);
assert.match(dashboardSource, /Data last updated:/);
assert.match(dashboardSource, /inset-\[28%\]/);
assert.match(dashboardSource, /max-w-\[18rem\]/);
assert.match(dashboardSource, /function buildTreasuryCommentary/);
assert.match(dashboardSource, /Treasury Intelligence/);
assert.match(dashboardSource, /Liquidity, movement, and concentration in USD\./);
assert.match(dashboardSource, /Executive Read:/);
assert.match(dashboardSource, /Net Cash Movement/);
assert.match(dashboardSource, /External Inflows/);
assert.match(dashboardSource, /External Outflows/);
assert.match(dashboardSource, /Est\. Internal Transfers/);
assert.match(dashboardSource, /estimateInternalTransferEliminations/);
assert.match(dashboardSource, /Ledger Source:/);
assert.match(dashboardSource, /usdInflow/);
assert.match(dashboardSource, /usdOutflow/);
assert.match(dashboardSource, /usdNet/);
assert.match(dashboardSource, /transactionBreakdowns: LedgerTransactionBreakdown\[\]/);
assert.doesNotMatch(dashboardSource, /still need balance or FX coverage/);
assert.match(dashboardRouteSource, /\.\.\.transactionResult\.map\(\(transaction\) => transaction\.currency\)/);
assert.match(dashboardSource, /w-full min-w-\[1040px\] table-fixed/);
assert.match(dashboardSource, /function sortMixRowsByExposure/);
assert.match(dashboardSource, /const displayRows = sortMixRowsByExposure\(mixRows\);/);
assert.match(dashboardSource, /money_processor: "Money Processors"/);
assert.match(dashboardSource, /liquidity_provider: "Liquidity Providers"/);
assert.match(dashboardSource, /operating_bank: "#2f6f68"/);
assert.match(dashboardSource, /client_money: "#8aa05d"/);
assert.match(dashboardSource, /money_processor: "#bf7a3a"/);
assert.match(dashboardSource, /liquidity_provider: "#5967c5"/);
assert.doesNotMatch(dashboardSource, /Largest Relationship/);
assert.doesNotMatch(dashboardSource, /Data Freshness/);
assert.match(dashboardSource, /hasConvertedBalances = convertedCount > 0/);
assert.doesNotMatch(dashboardSource, /Categories <span/);
assert.doesNotMatch(dashboardSource, /Accounts <span/);
assert.doesNotMatch(dashboardSource, /Total USD exposure; external float is/);
assert.doesNotMatch(dashboardSource, /Action Needs/);
assert.match(dashboardSource, /<LiquidityMixCard rows=\{categoryExposure\} convertedCount=\{convertedAccounts\.length\} \/>/);
assert.match(dashboardSource, /xl:grid-cols-\[1\.35fr_0\.65fr\]/);
assert.doesNotMatch(dashboardSource, /label="Bank Balances"/);
assert.doesNotMatch(dashboardSource, /label="External Float Share"/);
assert.doesNotMatch(dashboardSource, /Total Liquidity in USD/);
assert.doesNotMatch(dashboardSource, /USD Liquidity/);
assert.doesNotMatch(dashboardSource, /Cash\/Bank/);
assert.doesNotMatch(dashboardSource, /LP\/MP/);
assert.doesNotMatch(dashboardSource, /Balance completeness/);
assert.doesNotMatch(dashboardSource, /Treasury balance split/);
assert.match(dashboardSource, /const accountDetailRows = accounts\.filter\(hasNonZeroBalance\);/);
assert.match(dashboardSource, /No non-zero account balances are available yet\./);
assert.doesNotMatch(dashboardSource, /No balance date/);
assert.doesNotMatch(dashboardSource, />No balance</);
assert.match(dashboardSource, /Liquidity Mix/);
assert.match(dashboardSource, /Other\/Remaining/);
assert.match(dashboardSource, /const displayedRows = maxRows \? rowsWithRemaining\(rows, maxRows\) : rows;/);
assert.match(dashboardSource, /<ExposureList rows=\{accountExposure\} totalUsd=\{totalUsd\} emptyLabel="No USD account balances yet\." maxRows=\{6\} \/>/);
assert.match(dashboardSource, /<ExposureList rows={entityExposure} totalUsd={totalUsd} emptyLabel="No USD entity balances yet\." \/>/);
assert.doesNotMatch(dashboardSource, /<ExposureList rows={categoryExposure}/);
assert.doesNotMatch(dashboardSource, /<ExposureList rows={entityExposure}[^>]*maxRows=/);
assert.doesNotMatch(dashboardSource, /accounts\.slice\(0,\s*12\)/);
assert.match(dashboardSource, /Own Funds/);
assert.match(dashboardSource, /Client Funds/);
assert.match(dashboardSource, /Money Processors/);
assert.match(dashboardSource, /Liquidity Providers/);
assert.match(xeroLedgerSource, /shouldExcludeLedgerAccount/);
assert.match(xeroLedgerSource, /account_type: classifyLedgerAccountType/);
assert.match(entityAccountRouteSource, /shouldExcludeLedgerAccount/);
assert.match(entityAccountRouteSource, /account_type: classifyLedgerAccountType/);

console.log("ledger-dashboard smoke ok");
