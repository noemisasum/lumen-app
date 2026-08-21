import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");
const sourcePath = path.join(appDir, "src/lib/server/statement-csv-parser.ts");
const outputDir = path.join(appDir, ".statement-parser-smoke");
const outputPath = path.join(outputDir, "statement-csv-parser.mjs");

mkdirSync(outputDir, { recursive: true });

const source = readFileSync(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});

writeFileSync(outputPath, transpiled.outputText);

const { parseCsvStatement } = await import(`${pathToFileURL(outputPath).href}?${Date.now()}`);

const input = {
  statementImportId: "statement-import-smoke",
  entityId: "entity-smoke",
  bankAccountId: "bank-account-smoke",
  defaultCurrency: "USD",
  fileName: "statement-smoke.csv",
};

const adjustment = parseCsvStatement("Date,Description,Amount,Balance\n2024-01-02,Closing balance adjustment,10.00,1010.00\n", input);
assert.equal(adjustment.transactions.length, 1);
assert.equal(adjustment.transactions[0]?.description, "Closing balance adjustment");
assert.equal(adjustment.transactions[0]?.signedAmount, 10);
assert.equal(adjustment.balances.filter((balance) => balance.sourceRecordType === "csv_balance_snapshot").length, 0);

const standaloneBalances = parseCsvStatement(
  "Date,Description,Amount,Balance\n2024-01-01,Opening Balance,1000.00,\n2024-01-31,Closing Balance,,1010.00\n",
  input,
);
assert.equal(standaloneBalances.transactions.length, 0);
assert.deepEqual(
  standaloneBalances.balances.map((balance) => [balance.balanceType, balance.amount]),
  [
    ["opening", 1000],
    ["closing", 1010],
  ],
);

const inferredSlashDates = parseCsvStatement("Date,Description,Amount\n01/02/2024,Coffee,-5.00\n13/02/2024,Deposit,25.00\n", input);
assert.equal(inferredSlashDates.transactions[0]?.transactionDate, "2024-02-01");
assert.equal(inferredSlashDates.transactions[1]?.transactionDate, "2024-02-13");

const preamble = parseCsvStatement("Account,Everyday\nGenerated,2024-02-01\n\nDate,Description,Amount\n2024-02-01,Coffee,-5.00\n", input);
assert.equal(preamble.transactions.length, 1);
assert.equal(preamble.transactions[0]?.transactionDate, "2024-02-01");

rmSync(outputDir, { recursive: true, force: true });
console.log("statement-csv-parser smoke checks passed");
