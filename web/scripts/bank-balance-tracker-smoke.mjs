import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");
const outputDir = path.join(appDir, ".bank-balance-tracker-smoke");
const sources = [
  ["sample-data", path.join(appDir, "src/lib/bank-balance-tracker/sample-data.ts")],
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

const { sampleBankBalanceWorkbook } = await import(`${pathToFileURL(path.join(outputDir, "sample-data.mjs")).href}?${Date.now()}`);
const transforms = await import(`${pathToFileURL(path.join(outputDir, "transforms.mjs")).href}?${Date.now()}`);
const { adaptLedgerDashboardToBankBalanceData } = await import(`${pathToFileURL(path.join(outputDir, "ledger-adapter.mjs")).href}?${Date.now()}`);

const data = sampleBankBalanceWorkbook;

assert.equal(data.metadata.title, "Mitrade Group Bank Balance Dashboard");
assert.equal(data.metadata.selectedMonth, "2026-04-30");
assert.equal(data.kpis.accounts, 101);
assert.equal(data.kpis.currencies, 9);
assert.equal(data.monthlyBalances.length, 101);
assert.equal(data.bankMapping.length, 101);
assert.equal(data.fxRates.length, 193);
assert.equal(data.statementUploads.columns.length, 8);
assert.equal(data.statementUploads.rows.length, 0);

assert.equal(Math.round(data.kpis.totalUsd), 79755166);
assert.equal(Math.round(data.kpis.priorMonthUsd), 76388155);
assert.equal(Math.round(data.kpis.movementUsd), 3367010);

const recalculatedTotal = data.monthlyBalances.reduce((total, row) => total + row.balanceUsd, 0);
assert.equal(Math.round(recalculatedTotal), Math.round(data.kpis.totalUsd));
assert.equal(data.monthlyBalances.every((row) => !/\d{6,}/.test(row.maskedAccountNo)), true);
assert.equal(data.monthlyBalances.every((row) => !/\([^)]+\d{5,}[^)]*\)/.test(row.accountEntity)), true);

const australiaClientTrust = transforms.filterBalances(data.monthlyBalances, {
  country: "Australia",
  fundType: "Client Funds",
  currency: "",
  search: "",
});
assert.equal(australiaClientTrust.length > 0, true);
assert.equal(australiaClientTrust.every((row) => row.country === "Australia" && row.fundType === "Client Funds"), true);

const sortedMovement = transforms.sortBalances(data.monthlyBalances, "movementUsd");
assert.equal(Math.abs(sortedMovement[0].movementUsd) >= Math.abs(sortedMovement.at(-1).movementUsd), true);

const readiness = transforms.statementReadiness(data);
assert.deepEqual(readiness, {
  readyAccounts: 101,
  mappedAccounts: 101,
  unmappedAccounts: 0,
  activeMappings: 101,
  uploadRows: 0,
});

const usedRates = transforms.usedFxRates(data.fxRates, data.monthlyBalances);
assert.deepEqual(
  usedRates.map((rate) => rate.currency).sort(),
  ["AUD", "CNH", "CNY", "EUR", "GBP", "HKD", "MUR", "SGD", "USD"],
);

const accountEntityBalances = transforms.groupAccountEntityBalances(data.monthlyBalances);
assert.equal(accountEntityBalances.length > 0, true);
assert.equal(accountEntityBalances.length, new Set(data.monthlyBalances.map((row) => row.accountEntity)).size);
assert.equal(Math.round(accountEntityBalances.reduce((total, row) => total + row.balanceUsd, 0)), Math.round(data.kpis.totalUsd));
assert.equal(accountEntityBalances[0].balanceUsd >= accountEntityBalances.at(-1).balanceUsd, true);

const bankExposure = transforms.groupBankExposure(data.monthlyBalances);
assert.equal(bankExposure.length > 0, true);
assert.equal(Math.round(bankExposure.reduce((total, row) => total + row.balanceUsd, 0)), Math.round(data.kpis.totalUsd));
assert.equal(bankExposure[0].balanceUsd >= bankExposure.at(-1).balanceUsd, true);

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
    ],
    totalsBySource: [{ source: "xero", currency: "AUD", amount: 1500, accountCount: 1 }],
  },
  data.fxRates,
);

assert.equal(ledgerDashboard.metadata.source.includes("Xero-backed"), true);
assert.equal(ledgerDashboard.metadata.workbookSheets.length, 0);
assert.equal(ledgerDashboard.kpis.totalUsd, 975);
assert.equal(ledgerDashboard.monthlyBalances[0].fundType, "Xero");
assert.equal(ledgerDashboard.monthlyBalances[0].sourceWorkbook, "Xero ledger");
assert.equal(adaptLedgerDashboardToBankBalanceData({ asOf: "2026-08-26T09:00:00.000Z", entities: [], accounts: [], totalsBySource: [] }, data.fxRates), null);

console.log("Bank balance tracker smoke passed.");
