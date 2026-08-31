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
const pdfSourcePath = path.join(appDir, "src/lib/server/statement-pdf-parser.ts");
const fileTypeSourcePath = path.join(appDir, "src/lib/server/statement-file-type.ts");
const outputDir = path.join(appDir, ".statement-parser-smoke");
const outputPath = path.join(outputDir, "statement-csv-parser.mjs");
const excelOutputPath = path.join(outputDir, "statement-excel-parser.mjs");
const pdfOutputPath = path.join(outputDir, "statement-pdf-parser.mjs");
const fileTypeOutputPath = path.join(outputDir, "statement-file-type.mjs");

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

const pdfSource = readFileSync(pdfSourcePath, "utf8");
const pdfTranspiled = ts.transpileModule(pdfSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
writeFileSync(
  pdfOutputPath,
  pdfTranspiled.outputText
    .replace('from "@/lib/server/statement-csv-parser"', 'from "./statement-csv-parser.mjs"')
    .replace('from "@/lib/server/bank-ledger"', 'from "./bank-ledger.mjs"'),
);

const fileTypeSource = readFileSync(fileTypeSourcePath, "utf8");
const fileTypeTranspiled = ts.transpileModule(fileTypeSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
writeFileSync(fileTypeOutputPath, fileTypeTranspiled.outputText);

const { parseCsvStatement } = await import(`${pathToFileURL(outputPath).href}?${Date.now()}`);
const { parseExcelStatement, parseLegacyExcelStatement } = await import(`${pathToFileURL(excelOutputPath).href}?${Date.now()}`);
const { isUnsupportedPdfStatementLayoutError, parsePdfStatementText } = await import(`${pathToFileURL(pdfOutputPath).href}?${Date.now()}`);
const { statementParserType } = await import(`${pathToFileURL(fileTypeOutputPath).href}?${Date.now()}`);

const input = {
  statementImportId: "statement-import-smoke",
  entityId: "entity-smoke",
  bankAccountId: "bank-account-smoke",
  defaultCurrency: "USD",
  fileName: "statement-smoke.csv",
};

function parseSanitizedPdfFixture(pdfText, defaultCurrency = "HKD") {
  return parsePdfStatementText(pdfText, { ...input, defaultCurrency, fileName: "sanitized-provider-statement.pdf" });
}

assert.equal(statementParserType("uploads/hw-statement.PDF", null), "pdf");
assert.equal(statementParserType("uploads/hw-statement.bin", "application/pdf"), "pdf");
assert.equal(statementParserType("uploads/hw-statement", "application/x-pdf"), "pdf");
assert.equal(statementParserType("uploads/receipt.png", "image/png"), null);

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

const normalizedAccountStatement = parseCsvStatement(
  [
    "Date,Value Date,Description,Reference,Debit,Credit,Running Balance",
    "2026-07-29,2026-07-29,Account Maintenance Charges - For 1/7-31/7/26,,60,,151392.16",
    "2026-07-30,2026-07-30,Synthetic transfer,REF-001,,120,151512.16",
    "2026-07-31,2026-07-31,Synthetic payment,REF-002,12.5,,151499.66",
    "",
  ].join("\n"),
  { ...input, defaultCurrency: "HKD", fileName: "normalized-account-statement.csv" },
);
assert.equal(normalizedAccountStatement.transactions.length, 3);
assert.equal(normalizedAccountStatement.transactions[0]?.transactionDate, "2026-07-29");
assert.equal(normalizedAccountStatement.transactions[0]?.postedDate, "2026-07-29");
assert.equal(normalizedAccountStatement.transactions[0]?.description, "Account Maintenance Charges - For 1/7-31/7/26");
assert.equal(normalizedAccountStatement.transactions[0]?.signedAmount, -60);
assert.equal(normalizedAccountStatement.balances[0]?.amount, 151392.16);

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

const xlsShortAccountStatement = parseLegacyExcelStatement(
  workbookBuffer(
    [
      [
        "account_statement",
        [
          ["Account Alias", "", "", "", "000-000", "", "", "", "", "", "Selected Period", "", "", "User Defined", "", ""],
          ["Account Number", "", "", "", "000-000", "", "", "", "", "", "From Date", "", "", "01/07/2026", "", ""],
          ["Account Owner", "", "", "", "Synthetic Owner", "", "", "", "", "", "To Date", "", "", "31/07/2026", "", ""],
          ["", "1", "01/07/2026", "01/07/2026", "", "Synthetic debit one", "", "", "SHORT-001", "", "", "TFR", 12.75, "", "", 987.25],
          ["", "2", "02/07/2026", "02/07/2026", "", "Synthetic debit two", "", "", "SHORT-002", "", "", "TFR", 20, "", "", 967.25],
          ["", "3", "03/07/2026", "03/07/2026", "", "Synthetic debit three", "", "", "SHORT-003", "", "", "TFR", 7.25, "", "", 960],
        ],
      ],
    ],
    "xls",
  ),
  { ...input, defaultCurrency: "HKD", fileName: "synthetic-short-account-statement.xls" },
);
assert.equal(xlsShortAccountStatement.transactions.length, 3);
assert.equal(xlsShortAccountStatement.transactions[0]?.transactionDate, "2026-07-01");
assert.equal(xlsShortAccountStatement.transactions[0]?.signedAmount, -12.75);
assert.equal(xlsShortAccountStatement.transactions[2]?.reference, "SHORT-003");
assert.equal(xlsShortAccountStatement.balances.length, 3);

const hwPdfText = `
H&W Commercial Banking
Account Statement
Account Number 000-000-000 Currency HKD
Statement Period 01/07/2026 to 31/07/2026
Opening Balance HKD 151,452.16
Date Value Date Description Debit Credit Balance
29/07/2026 29/07/2026 Account Maintenance Charges - For 1/7-31/7/26 60.00 151,392.16
30/07/2026 30/07/2026 Synthetic transfer Reference number REF-001 120.00 151,512.16
31/07/2026 31/07/2026 Synthetic payment Bank reference number BP-002 12.50 151,499.66
Total Debit 72.50
Total Credit 120.00
Closing Balance HKD 151,499.66
Page 1 of 1
`;
const hwPdf = parsePdfStatementText(hwPdfText, { ...input, defaultCurrency: "HKD", fileName: "sanitized-hw.pdf" });
assert.equal(hwPdf.transactions.length, 3);
assert.equal(hwPdf.transactions[0]?.transactionDate, "2026-07-29");
assert.equal(hwPdf.transactions[0]?.postedDate, "2026-07-29");
assert.equal(hwPdf.transactions[0]?.description, "Account Maintenance Charges - For 1/7-31/7/26");
assert.equal(hwPdf.transactions[0]?.signedAmount, -60);
assert.equal(hwPdf.transactions[1]?.signedAmount, 120);
assert.equal(hwPdf.transactions[1]?.reference, "REF-001");
assert.equal(hwPdf.transactions[2]?.signedAmount, -12.5);
assert.equal(hwPdf.transactions[2]?.reference, "BP-002");
assert.equal(hwPdf.transactions[0]?.sourceRowId, "statement-import-smoke:pdf:line:8");
assert.equal(hwPdf.transactions[0]?.sourceRecordType, "pdf_row");
assert.deepEqual(
  hwPdf.balances.map((balance) => [balance.balanceType, balance.amount, balance.sourceRecordType]),
  [
    ["opening", 151452.16, "pdf_balance_snapshot"],
    ["closing", 151499.66, "pdf_balance_snapshot"],
    ["reported", 151392.16, "pdf_running_balance"],
    ["reported", 151512.16, "pdf_running_balance"],
    ["reported", 151499.66, "pdf_running_balance"],
  ],
);

const signedAmountHwPdf = parsePdfStatementText(
  `
H&W Commercial Banking Account Statement
Statement Period 01/08/2026 to 31/08/2026
Date Description Amount Balance
01/08/2026 Card refund +25.25 1,025.25
02/08/2026 Card purchase (10.00) 1,015.25
Current Balance 1,015.25
`,
  { ...input, defaultCurrency: "HKD", fileName: "sanitized-hw-signed.pdf" },
);
assert.equal(signedAmountHwPdf.transactions.length, 2);
assert.equal(signedAmountHwPdf.transactions[0]?.signedAmount, 25.25);
assert.equal(signedAmountHwPdf.transactions[1]?.signedAmount, -10);

const dbsCurrentPdf = parseSanitizedPdfFixture(`
DBS Bank (Hong Kong) Limited
Current Account Statement
Account Number 000109286 Currency HKD
Statement Period 13/07/2026 to 31/07/2026
Opening Balance HKD 1,000.00
Transaction Date Value Date Description Debit Credit Balance
13/07/2026 13/07/2026 Outward FPS payment to vendor
Reference number DBS-CUR-001 50.00 950.00
14/07/2026 14/07/2026 Incoming transfer from customer Reference number DBS-CUR-002 100.00 1,050.00
Closing Balance HKD 1,050.00
Page 1 of 1
`);
assert.equal(dbsCurrentPdf.transactions.length, 2);
assert.equal(dbsCurrentPdf.transactions[0]?.description, "Outward FPS payment to vendor");
assert.equal(dbsCurrentPdf.transactions[0]?.signedAmount, -50);
assert.equal(dbsCurrentPdf.transactions[0]?.reference, "DBS-CUR-001");
assert.equal(dbsCurrentPdf.transactions[1]?.signedAmount, 100);
assert.equal(dbsCurrentPdf.balances.at(-1)?.amount, 1050);

const dbsSavingsPdf = parseSanitizedPdfFixture(`
DBS Bank (Hong Kong) Limited
Savings Account Statement
Account 000071201 CNY GBP HKD
Statement from 13 Aug 2026 to 31 Aug 2026
Date Details Withdrawal Deposit Balance
13 Aug 2026 FX conversion - CNY leg DBS-SAV-001 40.00 0.00 960.00
14 Aug 2026 Interest payment
Reference number DBS-SAV-002 0.00 12.34 972.34
Current Balance HKD 972.34
Page 1 of 1
`);
assert.equal(dbsSavingsPdf.transactions.length, 2);
assert.equal(dbsSavingsPdf.transactions[0]?.transactionDate, "2026-08-13");
assert.equal(dbsSavingsPdf.transactions[0]?.signedAmount, -40);
assert.equal(dbsSavingsPdf.transactions[1]?.signedAmount, 12.34);
assert.equal(dbsSavingsPdf.transactions[1]?.description, "Interest payment");

const scbCurrentPdf = parseSanitizedPdfFixture(`
Standard Chartered Bank Hong Kong
Current Account HKD Statement
Statement Period 13/08/2026 - 31/08/2026
Date Transaction Details Amount Balance
13/08/2026 Telegraphic transfer received REF SCB-CUR-001 +200.00 1,200.00
14/08/2026 Autopay settlement REF SCB-CUR-002 (75.25) 1,124.75
Statement Balance HKD 1,124.75
`);
assert.equal(scbCurrentPdf.transactions.length, 2);
assert.equal(scbCurrentPdf.transactions[0]?.signedAmount, 200);
assert.equal(scbCurrentPdf.transactions[1]?.signedAmount, -75.25);

const scbSavingsPdf = parseSanitizedPdfFixture(`
SCB Savings Account Statement
Account currencies CNY HKD USD
Statement Date 13/08/2026 to 31/08/2026
Date Transaction Details Deposit Withdrawal Balance
13/08/2026 Inward remittance SCB-SAV-001 250.00 0.00 1,250.00
14/08/2026 FX sweep to operating account
Bank reference number SCB-SAV-002 0.00 100.00 1,150.00
Closing Balance HKD 1,150.00
`);
assert.equal(scbSavingsPdf.transactions.length, 2);
assert.equal(scbSavingsPdf.transactions[0]?.signedAmount, 250);
assert.equal(scbSavingsPdf.transactions[1]?.signedAmount, -100);
assert.equal(scbSavingsPdf.transactions[1]?.reference, "SCB-SAV-002");

const hsbcCurrentPdf = parseSanitizedPdfFixture(`
HSBC Hong Kong
Current Account HKD Statement
Statement Period 13 Aug 2026 to 31 Aug 2026
Opening Balance 2,000.00
Date Transaction details Debit Credit Balance
13 Aug 2026 CHATS payment to supplier
Bank reference number HSBC-CUR-001 300.00 1,700.00
14 Aug 2026 Client receipt HSBC-CUR-002 500.00 2,200.00
Closing Balance 2,200.00
`);
assert.equal(hsbcCurrentPdf.transactions.length, 2);
assert.equal(hsbcCurrentPdf.transactions[0]?.postedDate, "2026-08-13");
assert.equal(hsbcCurrentPdf.transactions[0]?.signedAmount, -300);
assert.equal(hsbcCurrentPdf.transactions[1]?.signedAmount, 500);

const hsbcSavingsPdf = parseSanitizedPdfFixture(`
HSBC Savings Account Statement
HKD USD CNY account family
Statement Period 13/08/2026 to 31/08/2026
Date Narrative Money In Money Out Balance
13/08/2026 Time deposit maturity HSBC-SAV-001 800.00 0.00 2,800.00
14/08/2026 Transfer to current account HSBC-SAV-002 0.00 600.00 2,200.00
Available Balance HKD 2,200.00
`);
assert.equal(hsbcSavingsPdf.transactions.length, 2);
assert.equal(hsbcSavingsPdf.transactions[0]?.signedAmount, 800);
assert.equal(hsbcSavingsPdf.transactions[1]?.signedAmount, -600);

const oslPdf = parseSanitizedPdfFixture(
  `
OSL Digital Securities
USD USDT Account Statement
Statement Period 13 Aug 2026 to 31 Aug 2026
Time Type Asset Amount Balance
13 Aug 2026 Deposit USD +1,000.00 1,000.00
14 Aug 2026 Conversion USDT
Reference number OSL-USDT-001 -250.00 750.00
Current Balance USD 750.00
`,
  "USD",
);
assert.equal(oslPdf.transactions.length, 2);
assert.equal(oslPdf.transactions[0]?.signedAmount, 1000);
assert.equal(oslPdf.transactions[1]?.description, "Conversion USDT");
assert.equal(oslPdf.transactions[1]?.signedAmount, -250);

assert.throws(
  () =>
    parsePdfStatementText(
      `
H&W Commercial Banking Account Statement
Statement Period 01/09/2026 to 30/09/2026
Date Description Debit Credit Balance
01/09/2026 Ambiguous collapsed row 50.00 950.00
`,
      { ...input, defaultCurrency: "HKD", fileName: "ambiguous-hw.pdf" },
    ),
  /unsigned amount without a reliable balance delta/,
);

assert.throws(
  () =>
    parsePdfStatementText(
      `
Generic Bank Monthly Summary
Opening Balance 100.00
Closing Balance 100.00
`,
      { ...input, defaultCurrency: "HKD", fileName: "generic-summary.pdf" },
    ),
  isUnsupportedPdfStatementLayoutError,
);

rmSync(outputDir, { recursive: true, force: true });
console.log("statement parser smoke checks passed");
