import * as xlsx from "@e965/xlsx";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");
const defaultOutputPath = path.join(appDir, "src/lib/bank-balance-tracker/sample-data.ts");
const workbookPath = process.argv[2];
const outputPath = process.argv[3] ?? defaultOutputPath;
const maskedSourceWorkbook = "Masked workbook sample";

if (!workbookPath) {
  throw new Error("Usage: node scripts/extract-bank-balance-workbook.mjs /path/to/workbook.xlsx [output.ts]");
}

const workbook = xlsx.read(readFileSync(workbookPath), { type: "buffer", cellDates: true });

function rows(sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Missing required sheet: ${sheetName}`);
  return xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
}

function text(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return localIsoDate(value);
  return String(value).trim();
}

function number(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function localIsoDate(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isoDateTime(value) {
  if (value instanceof Date) return value.toISOString();
  return text(value);
}

function headerMap(headerRow) {
  return new Map(headerRow.map((header, index) => [text(header), index]).filter(([header]) => header));
}

function fromHeader(row, map, header) {
  const index = map.get(header);
  return index === undefined ? null : row[index];
}

function maskAccountNo(value) {
  const raw = text(value);
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "Not provided";
  return `...${digits.slice(-4).padStart(Math.min(4, digits.length), "*")}`;
}

function maskAccountToken(raw) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "(masked)";
  return `(acct ...${digits.slice(-4)})`;
}

function sanitizeAccountEntity(value) {
  return text(value)
    .replace(/\((?=[^)0-9]*[0-9])[^)]{5,}\)/g, (match) => maskAccountToken(match))
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9 ]{8,}\b/g, (match) => maskAccountToken(match))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeString(value, fallback = "") {
  return text(value) || fallback;
}

const dashboardRows = rows("Dashboard");
const monthlyRows = rows("Monthly Balances");
const countryRows = rows("Summary by Country");
const licenseRows = rows("Summary by License");
const mappingRows = rows("Bank Mapping");
const statementRows = rows("Statement Uploads");
const workbookSummaryRows = rows("Workbook Summary");
const xeRateRows = rows("XE Rates");

const kpiRow = dashboardRows[4] ?? [];
const metadataRow = dashboardRows[2] ?? [];

const kpis = {
  totalUsd: number(kpiRow[1]),
  priorMonthUsd: number(kpiRow[3]),
  movementUsd: number(kpiRow[5]),
  movementPct: number(kpiRow[7]),
  accounts: number(kpiRow[9]),
  currencies: number(kpiRow[11]),
};

const monthlyHeader = headerMap(monthlyRows[0] ?? []);
const monthlyBalances = monthlyRows.slice(1).filter((row) => text(row[0])).map((row) => ({
  monthEnd: text(fromHeader(row, monthlyHeader, "Month End")),
  country: normalizeString(fromHeader(row, monthlyHeader, "Country"), "Unassigned"),
  accountEntity: sanitizeAccountEntity(fromHeader(row, monthlyHeader, "Account / Entity")),
  bank: normalizeString(fromHeader(row, monthlyHeader, "Bank"), "Unassigned Bank"),
  maskedAccountNo: maskAccountNo(fromHeader(row, monthlyHeader, "Account No")),
  fundType: normalizeString(fromHeader(row, monthlyHeader, "Fund Type"), "Unclassified"),
  currency: normalizeString(fromHeader(row, monthlyHeader, "Currency"), "USD").toUpperCase(),
  fxUnitsPerUsd: number(fromHeader(row, monthlyHeader, "FX Units per USD")),
  balanceLocal: number(fromHeader(row, monthlyHeader, "Balance Local")),
  balanceUsd: number(fromHeader(row, monthlyHeader, "Balance USD")),
  priorMonthUsd: number(fromHeader(row, monthlyHeader, "Prior Month USD")),
  movementUsd: number(fromHeader(row, monthlyHeader, "Movement USD")),
  movementPct: nullableNumber(fromHeader(row, monthlyHeader, "Movement %")),
  sourceWorkbook: maskedSourceWorkbook,
  statementFileRef: text(fromHeader(row, monthlyHeader, "Statement File / Ref")) || null,
  notes: text(fromHeader(row, monthlyHeader, "Notes")) || null,
}));

const countryHeader = headerMap(countryRows[0] ?? []);
const countrySummary = countryRows.slice(1).filter((row) => text(row[1])).map((row) => {
  const priorMonthUsd = number(fromHeader(row, countryHeader, "Last Month USD"));
  const movementUsd = number(fromHeader(row, countryHeader, "Movement USD"));
  return {
    country: normalizeString(fromHeader(row, countryHeader, "Country")),
    priorMonthUsd,
    currentMonthUsd: number(fromHeader(row, countryHeader, "This Month USD")),
    movementUsd,
    movementPct: priorMonthUsd ? movementUsd / priorMonthUsd : 0,
  };
});

const licenseHeader = headerMap(licenseRows[0] ?? []);
const licenseSummary = licenseRows.slice(1).filter((row) => text(row[1])).map((row) => ({
  license: normalizeString(fromHeader(row, licenseHeader, "License")),
  clientFundsUsd: number(fromHeader(row, licenseHeader, "Client Funds USD")),
  corporateFundsUsd: number(fromHeader(row, licenseHeader, "Corporate Funds USD")),
  totalUsd: number(fromHeader(row, licenseHeader, "Total USD")),
}));

const mappingHeader = headerMap(mappingRows[0] ?? []);
const bankMapping = mappingRows.slice(1).filter((row) => text(row[0])).map((row) => ({
  country: normalizeString(fromHeader(row, mappingHeader, "Country"), "Unassigned"),
  accountEntity: sanitizeAccountEntity(fromHeader(row, mappingHeader, "Account / Entity")),
  bank: normalizeString(fromHeader(row, mappingHeader, "Bank"), "Unassigned Bank"),
  maskedAccountNo: maskAccountNo(fromHeader(row, mappingHeader, "Account No")),
  fundType: normalizeString(fromHeader(row, mappingHeader, "Fund Type"), "Unclassified"),
  currency: normalizeString(fromHeader(row, mappingHeader, "Currency"), "USD").toUpperCase(),
  defaultActive: text(fromHeader(row, mappingHeader, "Default Active?")).toUpperCase() === "Y",
  statementMatchingNotes: text(fromHeader(row, mappingHeader, "Statement Matching Notes")) || null,
}));

const statementHeader = (statementRows[0] ?? []).map(text).filter(Boolean);
const statementUploads = {
  columns: statementHeader,
  rows: statementRows.slice(1).filter((row) => row.some((cell) => text(cell))).map((row) =>
    Object.fromEntries(statementHeader.map((header, index) => [header, row[index] instanceof Date ? localIsoDate(row[index]) : row[index]])),
  ),
};

const topBanks = [];
for (let index = 27; index < dashboardRows.length; index += 1) {
  const row = dashboardRows[index];
  if (!text(row?.[0])) break;
  topBanks.push({ bank: normalizeString(row[0]), totalUsd: number(row[1]), movementUsd: number(row[2]) });
}

function concentrationAtOffset(offset) {
  const result = [];
  let entityGroup = "";

  for (let index = 0; index < workbookSummaryRows.length; index += 1) {
    const row = workbookSummaryRows[index] ?? [];
    const label = text(row[offset]);
    const nextLabel = text(workbookSummaryRows[index + 1]?.[offset]);

    if (label && nextLabel === "Row Labels") {
      entityGroup = label;
      index += 1;
      continue;
    }

    if (!entityGroup || !label || label === "Row Labels") continue;
    if (label === "Grand Total") {
      entityGroup = "";
      continue;
    }

    result.push({
      entityGroup: entityGroup.replace(/\s+/g, " ").trim(),
      bank: label.replace(/\s+/g, " ").trim(),
      totalUsd: number(row[offset + 1]),
      proportion: number(row[offset + 2]),
      hhiIndex: number(row[offset + 3]),
      concentrationLevel: normalizeString(row[offset + 4], "Low"),
    });
  }

  return result;
}

const fxRates = xeRateRows.slice(1).filter((row) => text(row[0])).map((row) => ({
  currency: normalizeString(row[0]).toUpperCase(),
  name: normalizeString(row[1]),
  unitsPerUsd: number(row[2]),
  usdPerUnit: number(row[3]),
}));

const data = {
  metadata: {
    title: normalizeString(dashboardRows[0]?.[0], "Bank Balance Dashboard"),
    selectedMonth: text(metadataRow[1]),
    lastRefreshed: isoDateTime(metadataRow[4]),
    dashboardView: normalizeString(metadataRow[7], "Bank balances"),
    workbookSheets: workbook.SheetNames,
    source: "Masked static sample extracted from the attached Mitrade workbook for presentation development.",
  },
  kpis,
  countrySummary,
  licenseSummary,
  topBanks,
  concentration: [...concentrationAtOffset(0), ...concentrationAtOffset(6)],
  monthlyBalances,
  bankMapping,
  statementUploads,
  fxRates,
};

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `import type { BankBalanceWorkbookData } from "./types";\n\nexport const sampleBankBalanceWorkbook = ${JSON.stringify(data, null, 2)} satisfies BankBalanceWorkbookData;\n`,
);

console.log(`Wrote ${outputPath}`);
console.log(`${monthlyBalances.length} monthly balances, ${bankMapping.length} bank mappings, ${fxRates.length} FX rates`);
