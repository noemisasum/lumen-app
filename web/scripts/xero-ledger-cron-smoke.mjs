import assert from "node:assert/strict";
import {
  defaultXeroLedgerSyncWindowDays,
  hasInternalSecretAccess,
  isoDateDaysBefore,
  maxXeroLedgerSyncWindowDays,
  parseBoundedInteger,
} from "../src/lib/server/maintenance-cron.ts";

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

console.log("Xero ledger cron smoke checks passed.");
