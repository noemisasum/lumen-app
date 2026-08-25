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

console.log("Bank balance tracker smoke passed.");
