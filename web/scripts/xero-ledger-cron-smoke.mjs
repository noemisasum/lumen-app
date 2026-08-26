import assert from "node:assert/strict";
import {
  defaultXeroLedgerSyncWindowDays,
  hasInternalSecretAccess,
  isoDateDaysBefore,
  maxXeroLedgerSyncWindowDays,
  parseBoundedInteger,
} from "../src/lib/server/maintenance-cron.ts";
import { normalizeBankBalance } from "../src/lib/server/bank-ledger.ts";
import { xeroReportBalances } from "../src/lib/server/xero-bank-summary-report.ts";

assert.deepEqual(
  hasInternalSecretAccess({
    authorization: "Bearer cron-secret",
    cronSecret: "cron-secret",
    maintenanceSecret: "maintenance-secret",
  }),
  { configured: true, ok: true },
);

assert.deepEqual(
  hasInternalSecretAccess({
    authorization: "Bearer maintenance-secret",
    cronSecret: "cron-secret",
    maintenanceSecret: "maintenance-secret",
  }),
  { configured: true, ok: true },
);

assert.deepEqual(
  hasInternalSecretAccess({
    maintenanceKey: "maintenance-secret",
    maintenanceSecret: "maintenance-secret",
  }),
  { configured: true, ok: true },
);

assert.deepEqual(hasInternalSecretAccess({ authorization: "Bearer wrong", cronSecret: "cron-secret" }), {
  configured: true,
  ok: false,
});
assert.deepEqual(hasInternalSecretAccess({}), { configured: false, ok: false });

assert.equal(parseBoundedInteger(undefined, defaultXeroLedgerSyncWindowDays, maxXeroLedgerSyncWindowDays), 90);
assert.equal(parseBoundedInteger("30", defaultXeroLedgerSyncWindowDays, maxXeroLedgerSyncWindowDays), 30);
assert.equal(parseBoundedInteger("999", defaultXeroLedgerSyncWindowDays, maxXeroLedgerSyncWindowDays), 366);
assert.equal(parseBoundedInteger("0", defaultXeroLedgerSyncWindowDays, maxXeroLedgerSyncWindowDays), 90);
assert.equal(parseBoundedInteger("not-a-number", defaultXeroLedgerSyncWindowDays, maxXeroLedgerSyncWindowDays), 90);
assert.equal(isoDateDaysBefore("2026-08-26", 90), "2026-05-28");

function reportRow(accountName, accountId, amount) {
  return {
    cells: [
      { value: accountName },
      { value: amount, attributes: [{ id: "account", value: accountId }] },
    ],
  };
}

function reportBalancesFor(reportCurrency) {
  const accountsByXeroId = new Map([
    ["zand-usd-xero-id", { id: "zand-usd-account", xero_bank_account_id: "zand-usd-xero-id", account_name: "Zand USD" }],
    ["global-usd-xero-id", { id: "global-usd-account", xero_bank_account_id: "global-usd-xero-id", account_name: "Mitrade Global USD" }],
    ["group-usd-xero-id", { id: "group-usd-account", xero_bank_account_id: "group-usd-xero-id", account_name: "Mitrade Group USD" }],
  ]);
  const accountsByName = new Map(Array.from(accountsByXeroId.values()).map((account) => [account.account_name.toLowerCase(), account]));
  return xeroReportBalances(
    {
      reports: [
        {
          rows: [
            reportRow("Zand USD", "zand-usd-xero-id", "2,134,149.89"),
            reportRow("Mitrade Global USD", "global-usd-xero-id", "875,000.00"),
            reportRow("Mitrade Group USD", "group-usd-xero-id", "1,250,000.00"),
          ],
        },
      ],
    },
    accountsByXeroId,
    accountsByName,
    "entity-id",
    "mapping-id",
    "2026-08-26",
    reportCurrency,
  );
}

const aedReportBalances = reportBalancesFor("AED");
assert.equal(aedReportBalances.find((balance) => balance.bankAccountId === "zand-usd-account")?.currency, "AED");
assert.equal(aedReportBalances.find((balance) => balance.bankAccountId === "zand-usd-account")?.amount, 2134149.89);
assert.equal(reportBalancesFor("AUD").find((balance) => balance.bankAccountId === "global-usd-account")?.currency, "AUD");
assert.equal(reportBalancesFor("SGD").find((balance) => balance.bankAccountId === "group-usd-account")?.currency, "SGD");
assert.equal(reportBalancesFor("not-a-currency").length, 0);

assert.equal(
  normalizeBankBalance({
    entityId: "entity-id",
    bankAccountId: "manual-account",
    source: "manual",
    balanceDate: "2026-08-26",
    balanceType: "closing",
    amount: 581116.21,
    currency: "USD",
    sourceRowId: "manual-statement-row",
  }).currency,
  "USD",
);

console.log("Xero ledger cron smoke checks passed.");
