import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");
const outputDir = path.join(appDir, ".bank-balance-tracker-smoke");
const sources = [
  ["transforms", path.join(appDir, "src/lib/bank-balance-tracker/transforms.ts")],
  ["ledger-adapter", path.join(appDir, "src/lib/bank-balance-tracker/ledger-adapter.ts")],
];

mkdirSync(outputDir, { recursive: true });

for (const [name, sourcePath] of sources) {
  const source = readFileSync(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
  });

  writeFileSync(path.join(outputDir, `${name}.mjs`), transpiled.outputText);
}

const pageSource = readFileSync(path.join(appDir, "src/app/dashboard/bank-balances/page.tsx"), "utf8");
assert.equal(pageSource.includes("sampleBankBalanceWorkbook"), false);
assert.equal(pageSource.includes("Cached baseline"), false);
assert.equal(pageSource.includes("Full reference sheet extracted"), false);

const transforms = await import(`${pathToFileURL(path.join(outputDir, "transforms.mjs")).href}?${Date.now()}`);
const { adaptLedgerDashboardToBankBalanceData } = await import(`${pathToFileURL(path.join(outputDir, "ledger-adapter.mjs")).href}?${Date.now()}`);

const ledgerDashboard = adaptLedgerDashboardToBankBalanceData(
  {
    asOf: "2026-08-26T09:00:00.000Z",
    entities: [{ id: "entity-1", name: "Mitrade AU", code: "AU", orgId: "org-1" }],
    accounts: [
      {
        id: "account-xero-1",
        entityId: "entity-1",
        accountName: "NAB Operating",
        currency: "AUD",
        source: "xero",
        latestBalance: {
          amount: 1500,
          currency: "AUD",
          originalCurrency: "AUD",
          source: "xero",
          balanceDate: "2026-08-25",
          asOf: "2026-08-26T08:30:00.000Z",
          usdConversion: { amount: 975, rate: 0.65, rateDate: "2026-08-25", asOf: "2026-08-26T08:30:00.000Z", source: "xe" },
        },
      },
      {
        id: "account-xero-2",
        entityId: "entity-1",
        accountName: "CBA HKD",
        currency: "HKD",
        source: "xero",
        latestBalance: {
          amount: 7800,
          currency: "HKD",
          originalCurrency: "HKD",
          source: "xero",
          balanceDate: "2026-08-25",
          asOf: "2026-08-26T08:30:00.000Z",
          usdConversion: null,
        },
      },
    ],
    totalsBySource: [{ source: "xero", currency: "AUD", amount: 1500, accountCount: 1 }],
    dataQualityIssues: [
      {
        code: "missing_usd_rate",
        severity: "warning",
        message: "No cached USD exchange rate is available for HKD.",
        entityId: "entity-1",
        bankAccountId: "account-xero-2",
        balanceId: "balance-2",
        currency: "HKD",
      },
    ],
  },
  [],
);

assert.equal(ledgerDashboard.metadata.source.includes("Xero-backed"), true);
assert.equal(ledgerDashboard.metadata.workbookSheets.length, 0);
assert.equal(ledgerDashboard.kpis.totalUsd, 975);
assert.equal(ledgerDashboard.kpis.priorMonthUsd, null);
assert.equal(ledgerDashboard.kpis.movementUsd, null);
assert.equal(ledgerDashboard.kpis.movementPct, null);
assert.equal(ledgerDashboard.kpis.accounts, 2);
assert.equal(ledgerDashboard.kpis.excludedUsdAccounts, 1);
assert.equal(ledgerDashboard.monthlyBalances[0].fundType, "Xero");
assert.equal(ledgerDashboard.monthlyBalances[0].sourceWorkbook, "Xero ledger");
assert.equal(ledgerDashboard.monthlyBalances[0].priorMonthUsd, null);
assert.equal(ledgerDashboard.monthlyBalances[0].movementUsd, null);
assert.equal(ledgerDashboard.monthlyBalances[1].balanceUsd, null);
assert.match(ledgerDashboard.monthlyBalances[1].notes, /excluded from USD totals/);
assert.equal(ledgerDashboard.topBanks.length, 1);
assert.equal(ledgerDashboard.concentration.length, 1);
assert.equal(ledgerDashboard.dataQualityIssues[0]?.code, "missing_usd_rate");
assert.equal(adaptLedgerDashboardToBankBalanceData({ asOf: "2026-08-26T09:00:00.000Z", entities: [], accounts: [], totalsBySource: [] }, []), null);

const filtered = transforms.filterBalances(ledgerDashboard.monthlyBalances, {
  country: "Mitrade AU",
  fundType: "Xero",
  currency: "",
  search: "",
});
assert.equal(filtered.length, 2);

const currencyExposure = transforms.groupCurrencyExposure(ledgerDashboard.monthlyBalances);
assert.equal(currencyExposure.find((row) => row.currency === "HKD")?.missingUsdCount, 1);
assert.equal(currencyExposure.find((row) => row.currency === "AUD")?.balanceUsd, 975);

const usedRates = transforms.usedFxRates(ledgerDashboard.fxRates, ledgerDashboard.monthlyBalances);
assert.deepEqual(
  usedRates.map((rate) => rate.currency).sort(),
  ["AUD", "HKD"],
);

console.log("Bank balance tracker smoke passed.");
