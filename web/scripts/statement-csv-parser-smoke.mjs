import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import * as xlsx from "@e965/xlsx";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");
const sourcePath = path.join(appDir, "src/lib/server/statement-csv-parser.ts");
const excelSourcePath = path.join(appDir, "src/lib/server/statement-excel-parser.ts");
const outputDir = path.join(appDir, ".statement-parser-smoke");
const outputPath = path.join(outputDir, "statement-csv-parser.mjs");
const excelOutputPath = path.join(outputDir, "statement-excel-parser.mjs");

mkdirSync(outputDir, { recursive: true });

const source = readFileSync(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});

writeFileSync(outputPath, transpiled.outputText);

const excelSource = readFileSync(excelSourcePath, "utf8");
const excelTranspiled = ts.transpileModule(excelSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
writeFileSync(
  excelOutputPath,
  excelTranspiled.outputText.replace(
    'from "@/lib/server/statement-csv-parser"',
    'from "./statement-csv-parser.mjs"',
  ),
);

const { parseCsvStatement } = await import(`${pathToFileURL(outputPath).href}?${Date.now()}`);
const { parseExcelStatement, parseLegacyExcelStatement } = await import(`${pathToFileURL(excelOutputPath).href}?${Date.now()}`);

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

const excelFixtureBase64 =
  "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";
const excelBuffer = Buffer.from(excelFixtureBase64, "base64");
const excel = await parseExcelStatement(excelBuffer, { ...input, fileName: "statement-smoke.xlsx" });
assert.equal(excel.transactions.length, 2);
assert.equal(excel.transactions[0]?.transactionDate, "2024-02-01");
assert.equal(excel.transactions[0]?.signedAmount, -5);
assert.equal(excel.transactions[1]?.signedAmount, 25);
assert.match(String(excel.transactions[0]?.sourceRowId), /^statement-import-smoke:sheet:\d+:row:4$/);
assert.equal(excel.transactions[0]?.sourceRecordType, "excel_row");
assert.equal(excel.balances.filter((balance) => balance.sourceRecordType === "excel_running_balance").length, 2);

function workbookBuffer(sheets, bookType) {
  const workbook = xlsx.utils.book_new();
  for (const [sheetName, rows] of sheets) {
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet(rows), sheetName);
  }
  return xlsx.write(workbook, { type: "buffer", bookType });
}

assert.throws(
  () => parseLegacyExcelStatement(Buffer.from("not a legacy workbook"), { ...input, fileName: "invalid.xls" }),
  /not a supported CFB\/BIFF workbook/,
);

const oversizedLegacyXls = Buffer.concat([
  workbookBuffer([["Sheet1", [["Date", "Description", "Amount"], ["2026-07-17", "Synthetic payment", 10]]]], "xls"),
  Buffer.alloc(1024 * 1024),
]);
assert.throws(
  () => parseLegacyExcelStatement(oversizedLegacyXls, { ...input, fileName: "oversized.xls" }),
  /larger than the current automatic parser limit of 1 MiB/,
);

const bankXlsx = await parseExcelStatement(
  workbookBuffer(
    [
      [
        "Activity_report_SIMPLE",
        [
          ["Account Currency", "HKD"],
          [],
          [
            "Date",
            "Description",
            "",
            "",
            "Transaction type",
            "Reference number",
            "Debit",
            "Credit",
            "Indicative balance",
            "Value date",
            "Bank reference number",
            "Branch code",
          ],
          [46220.125, "Synthetic card purchase", "", "", "Debit", "REF-001", 25.5, "", 974.5, 46220.125, "BANK-001", "001"],
          [46221, "", "", "", "", "", "", "", 974.5, "", "", ""],
        ],
      ],
    ],
    "xlsx",
  ),
  { ...input, defaultCurrency: "HKD", fileName: "synthetic-bank-layout.xlsx" },
);
assert.equal(bankXlsx.transactions.length, 1);
assert.equal(bankXlsx.transactions[0]?.transactionDate, "2026-07-17");
assert.equal(bankXlsx.transactions[0]?.postedDate, "2026-07-17");
assert.equal(bankXlsx.transactions[0]?.signedAmount, -25.5);
assert.equal(bankXlsx.transactions[0]?.reference, "REF-001");
assert.equal(bankXlsx.balances.length, 2);
assert.equal(bankXlsx.balances[1]?.sourceRowId, "statement-import-smoke:sheet:1:balance:reported:row:5");

const xlsLayoutA = parseLegacyExcelStatement(
  workbookBuffer(
    [
      [
        "Sheet1",
        [
          ["Account Number", "Period", "Currency", "Date", "Description", "Debit", "Credit", "Value Date", "Balance"],
          ["000-000", "Jul 2026", "HKD", "17/07/2026", "Synthetic payment", 10, "", "17/07/2026", 990],
          ["000-000", "Jul 2026", "HKD", "18/07/2026", "", "", "", "", 990],
        ],
      ],
    ],
    "xls",
  ),
  { ...input, defaultCurrency: "HKD", fileName: "synthetic-layout-a.xls" },
);
assert.equal(xlsLayoutA.transactions.length, 1);
assert.equal(xlsLayoutA.transactions[0]?.sourceRecordType, "xls_row");
assert.equal(xlsLayoutA.balances.length, 2);

const xlsLayoutB = parseLegacyExcelStatement(
  workbookBuffer(
    [
      [
        "Default Sheet",
        [
          ["Opening Balance", "", 1000],
          ["Ledger Balance", "", 1040],
          ["Available Balance", "", 1035],
          [],
          ["Date", "Value Date", "Transaction Description 1", "Transaction Description 2", "Debit", "Credit", "Running Balance"],
          ["17/07/2026", "17/07/2026", "Synthetic transfer", "extra detail", "", 40, 1040],
          ["18/07/2026", "", "", "", "", "", 1040],
        ],
      ],
    ],
    "xls",
  ),
  { ...input, defaultCurrency: "HKD", fileName: "synthetic-layout-b.xls" },
);
assert.equal(xlsLayoutB.transactions.length, 1);
assert.equal(xlsLayoutB.transactions[0]?.description, "Synthetic transfer");
assert.equal(xlsLayoutB.transactions[0]?.signedAmount, 40);
assert.deepEqual(
  xlsLayoutB.balances.map((balance) => balance.balanceType),
  ["opening", "reported", "available", "reported", "reported"],
);

const xlsLayoutC = parseLegacyExcelStatement(
  workbookBuffer(
    [
      [
        "account_statement",
        [
          ["Account", "000-000"],
          ["Owner", "Synthetic Owner"],
          ["From", "2026-07-01", "To", "2026-07-31"],
          ["", "1", "17/07/2026", "17/07/2026", "", "Synthetic merchant", "", "", "REF-C-001", "", "", "", 12.75, "", "", 987.25],
          ["", "2", "18/07/2026", "", "", "", "", "", "", "", "", "", "", "", "", 987.25],
        ],
      ],
    ],
    "xls",
  ),
  { ...input, defaultCurrency: "HKD", fileName: "synthetic-layout-c.xls" },
);
assert.equal(xlsLayoutC.transactions.length, 1);
assert.equal(xlsLayoutC.transactions[0]?.sourceRowId, "statement-import-smoke:sheet:1:row:4");
assert.equal(xlsLayoutC.transactions[0]?.reference, "REF-C-001");
assert.equal(xlsLayoutC.balances.length, 2);

rmSync(outputDir, { recursive: true, force: true });
console.log("statement parser smoke checks passed");
