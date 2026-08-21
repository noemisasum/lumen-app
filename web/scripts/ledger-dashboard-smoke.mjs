import assert from "node:assert/strict";
import { buildLedgerDashboardPayload } from "../src/lib/server/ledger-dashboard.ts";

const payload = buildLedgerDashboardPayload({
  asOf: "2026-08-22T00:00:00.000Z",
  windowDays: 30,
  entities: [
    { id: "entity-a", orgId: "org-1", name: "Lumen HK", code: "HK" },
    { id: "entity-b", orgId: "org-1", name: "Lumen US", code: "US" },
  ],
  accounts: [
    { id: "account-hkd", entityId: "entity-a", accountName: "HSBC Current", currency: "HKD", status: "active", source: "manual" },
    { id: "account-usd", entityId: "entity-b", accountName: "Mercury USD", currency: "USD", status: "active", source: "xero" },
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
  ],
});

assert.equal(payload.accounts.find((account) => account.id === "account-hkd")?.latestBalance?.amount, 250.5);
assert.deepEqual(payload.totalsByCurrency, [
  { currency: "HKD", amount: 250.5, accountCount: 1 },
  { currency: "USD", amount: 40, accountCount: 1 },
]);
assert.deepEqual(payload.totalsBySource, [
  { source: "manual", currency: "HKD", amount: 250.5, accountCount: 1 },
  { source: "xero", currency: "USD", amount: 40, accountCount: 1 },
]);
assert.deepEqual(payload.transactionBreakdowns, [
  { source: "manual", currency: "HKD", inflow: 75.25, outflow: 25, net: 50.25, transactionCount: 2 },
  { source: "xero", currency: "USD", inflow: 10, outflow: 0, net: 10, transactionCount: 1 },
]);

const largeAccounts = Array.from({ length: 5001 }, (_, index) => ({
  id: `large-account-${index}`,
  entityId: "entity-a",
  accountName: `Large Account ${index}`,
  currency: index % 2 === 0 ? "HKD" : "USD",
  status: "active",
  source: "manual",
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
});

assert.deepEqual(largePayload.totalsByCurrency, [
  { currency: "HKD", amount: 2501, accountCount: 2501 },
  { currency: "USD", amount: 5000, accountCount: 2500 },
]);
assert.deepEqual(largePayload.transactionBreakdowns, [
  { source: "manual", currency: "HKD", inflow: 334, outflow: 333, net: 1, transactionCount: 667 },
  { source: "manual", currency: "USD", inflow: 167, outflow: 167, net: 0, transactionCount: 334 },
]);

console.log("ledger-dashboard smoke ok");
