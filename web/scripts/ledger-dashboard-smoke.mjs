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

console.log("ledger-dashboard smoke ok");
