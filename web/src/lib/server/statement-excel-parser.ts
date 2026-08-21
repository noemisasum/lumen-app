import readXlsxFile, { type Row } from "read-excel-file/node";
import * as legacyXlsx from "@e965/xlsx";
import {
  parseStatementRows,
  type ParsedStatementInput,
  type ParsedStatementResult,
  type StatementParserRow,
} from "@/lib/server/statement-csv-parser";
import type { BankBalanceInput } from "@/lib/server/bank-ledger";

const maxExcelWorksheets = 20;
const maxExcelRowsPerSheet = 5000;
const maxExcelColumnsPerSheet = 100;
const maxExcelCellsPerSheet = maxExcelRowsPerSheet * maxExcelColumnsPerSheet;
const maxExcelZipEntries = 250;
const maxExcelCentralDirectoryBytes = 1024 * 1024;
const maxExcelWorksheetXmlBytes = 10 * 1024 * 1024;
const maxExcelTotalXmlBytes = 30 * 1024 * 1024;
const maxLegacyXlsBytes = 1024 * 1024;
const zipCentralDirectoryHeaderSignature = 0x02014b50;
const zipEndOfCentralDirectorySignature = 0x06054b50;
const zip64Sentinel = 0xffffffff;
const cfbHeaderMagic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const;

type XlsxZipEntry = {
  name: string;
  uncompressedSize: number;
};

type WorkbookSheetRows = {
  sheetNumber: number;
  sheetName: string;
  rows: StatementParserRow[];
};

export async function parseExcelStatement(excelData: ArrayBuffer, input: ParsedStatementInput): Promise<ParsedStatementResult> {
  const buffer = Buffer.from(excelData);
  validateXlsxArchive(buffer);
  const sheets = await readXlsxFile(buffer);

  if (!sheets.length) {
    throw new Error("Excel statement is empty.");
  }
  if (sheets.length > maxExcelWorksheets) {
    throw new Error(`Excel statement has too many worksheets for automatic parsing. Limit is ${maxExcelWorksheets}.`);
  }

  try {
    return parseWorkbookSheets(
      sheets.map((sheet, sheetIndex) => ({
        sheetNumber: sheetIndex + 1,
        sheetName: sheet.sheet,
        rows: worksheetRowsToStatementRows(sheet.data, sheet.sheet),
      })),
      input,
      "Excel",
      "excel",
    );
  } catch (primaryError) {
    try {
      return parseWorkbookSheets(readLegacyWorkbookRows(buffer), input, "Excel", "excel");
    } catch (fallbackError) {
      const detail = getErrorMessage(primaryError) || getErrorMessage(fallbackError);
      throw new Error(detail ? `Excel statement could not be parsed automatically. ${detail}` : "Excel statement is missing a recognizable transaction worksheet.");
    }
  }
}

export function parseLegacyExcelStatement(excelData: ArrayBuffer, input: ParsedStatementInput): ParsedStatementResult {
  const buffer = Buffer.from(excelData);
  validateLegacyXlsContainer(buffer);
  return parseWorkbookSheets(readLegacyWorkbookRows(buffer), input, "XLS", "xls");
}

function validateXlsxArchive(buffer: Buffer) {
  const entries = readXlsxZipEntries(buffer);
  const worksheetEntries = entries.filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(entry.name));

  if (!worksheetEntries.length) {
    throw new Error("Excel statement is missing worksheet data.");
  }
  if (worksheetEntries.length > maxExcelWorksheets) {
    throw new Error(`Excel statement has too many worksheets for automatic parsing. Limit is ${maxExcelWorksheets}.`);
  }

  let totalXmlBytes = 0;

  for (const entry of entries) {
    if (!isExcelXmlEntry(entry.name)) continue;

    totalXmlBytes += entry.uncompressedSize;
    if (totalXmlBytes > maxExcelTotalXmlBytes) {
      throw new Error("Excel statement XML is too large for automatic parsing.");
    }

    if (worksheetEntries.includes(entry) && entry.uncompressedSize > maxExcelWorksheetXmlBytes) {
      throw new Error(`Excel worksheet "${entry.name}" is too large for automatic parsing.`);
    }
  }
}

function readXlsxZipEntries(buffer: Buffer): XlsxZipEntry[] {
  const endOfCentralDirectoryOffset = findEndOfCentralDirectory(buffer);
  if (endOfCentralDirectoryOffset === -1) {
    throw new Error("Excel statement is not a valid XLSX archive.");
  }

  const entryCount = buffer.readUInt16LE(endOfCentralDirectoryOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(endOfCentralDirectoryOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(endOfCentralDirectoryOffset + 16);

  if (entryCount === 0 || entryCount > maxExcelZipEntries) {
    throw new Error(`Excel statement archive has too many files for automatic parsing. Limit is ${maxExcelZipEntries}.`);
  }
  if (centralDirectorySize > maxExcelCentralDirectoryBytes) {
    throw new Error("Excel statement archive metadata is too large for automatic parsing.");
  }
  if (
    entryCount === 0xffff ||
    centralDirectorySize === zip64Sentinel ||
    centralDirectoryOffset === zip64Sentinel
  ) {
    throw new Error("Excel statement archive is too large for automatic parsing.");
  }
  if (centralDirectoryOffset + centralDirectorySize > buffer.length) {
    throw new Error("Excel statement archive metadata is invalid.");
  }

  const entries: XlsxZipEntry[] = [];
  let offset = centralDirectoryOffset;
  const endOffset = centralDirectoryOffset + centralDirectorySize;

  while (offset < endOffset) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== zipCentralDirectoryHeaderSignature) {
      throw new Error("Excel statement archive metadata is invalid.");
    }

    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const fileCommentLength = buffer.readUInt16LE(offset + 32);
    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    const nextOffset = fileNameEnd + extraFieldLength + fileCommentLength;

    if (nextOffset > endOffset || fileNameEnd > buffer.length) {
      throw new Error("Excel statement archive metadata is invalid.");
    }
    if (compressedSize === zip64Sentinel || uncompressedSize === zip64Sentinel) {
      throw new Error("Excel statement archive is too large for automatic parsing.");
    }

    entries.push({
      name: buffer.toString("utf8", fileNameStart, fileNameEnd),
      uncompressedSize,
    });
    offset = nextOffset;
  }

  return entries;
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minEndRecordBytes = 22;
  const maxCommentBytes = 0xffff;
  const searchStart = Math.max(0, buffer.length - minEndRecordBytes - maxCommentBytes);

  for (let offset = buffer.length - minEndRecordBytes; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === zipEndOfCentralDirectorySignature) return offset;
  }

  return -1;
}

function isExcelXmlEntry(name: string) {
  return /^xl\/.+\.xml(?:\.rels)?$/i.test(name) || name === "[Content_Types].xml";
}

function validateLegacyXlsContainer(buffer: Buffer) {
  if (buffer.length > maxLegacyXlsBytes) {
    throw new Error("Legacy XLS statement is larger than the current automatic parser limit of 1 MiB.");
  }
  if (!hasCfbHeader(buffer)) {
    throw new Error("Legacy XLS statement is not a supported CFB/BIFF workbook.");
  }
}

function hasCfbHeader(buffer: Buffer) {
  if (buffer.length < cfbHeaderMagic.length) return false;
  return cfbHeaderMagic.every((byte, index) => buffer[index] === byte);
}

function worksheetRowsToStatementRows(rows: Row[], sheetName: string): StatementParserRow[] {
  if (rows.length > maxExcelRowsPerSheet) {
    throw new Error(`Excel worksheet "${sheetName}" has too many rows for automatic parsing. Limit is ${maxExcelRowsPerSheet}.`);
  }

  return rows.map((row, index) => {
    if (row.length > maxExcelColumnsPerSheet) {
      throw new Error(`Excel worksheet "${sheetName}" has too many columns for automatic parsing. Limit is ${maxExcelColumnsPerSheet}.`);
    }
    if (rows.length * Math.max(row.length, 1) > maxExcelCellsPerSheet) {
      throw new Error(`Excel worksheet "${sheetName}" is too large for automatic parsing.`);
    }
    return {
      fields: row.map(cellValueToText),
      sourceRowNumber: index + 1,
    };
  });
}

function parseWorkbookSheets(
  sheets: WorkbookSheetRows[],
  input: ParsedStatementInput,
  fileTypeName: string,
  sourceRecordPrefix: string,
): ParsedStatementResult {
  const parseFailures: string[] = [];

  for (const sheet of sheets) {
    const candidates = [
      ...layoutBStatementRows(sheet).map((rows) => ({ label: `${sheet.sheetName} normalized balance metadata`, rows })),
      { label: sheet.sheetName, rows: sheet.rows },
      ...layoutCStatementRows(sheet).map((rows) => ({ label: `${sheet.sheetName} normalized account_statement`, rows })),
    ];

    for (const candidate of candidates) {
      if (!candidate.rows.length || !candidate.rows.some((row) => row.fields.some((field) => field.trim()))) continue;

      try {
        return parseStatementRows(candidate.rows, input, {
          fileTypeName,
          sourceRecordPrefix,
          sourceRowId: (row) => `${input.statementImportId}:sheet:${sheet.sheetNumber}:row:${row.sourceRowNumber}`,
          balanceSourceRowId: (row, balanceType: BankBalanceInput["balanceType"]) =>
            `${input.statementImportId}:sheet:${sheet.sheetNumber}:balance:${balanceType}:row:${row.sourceRowNumber}`,
          rawPayload: (row) => excelRawPayload(input.fileName, sheet.sheetNumber, sheet.sheetName, row),
          runningBalancePayload: (row) => excelRawPayload(input.fileName, sheet.sheetNumber, sheet.sheetName, row),
          balancePayload: (row) => excelRawPayload(input.fileName, sheet.sheetNumber, sheet.sheetName, row),
        });
      } catch (error) {
        parseFailures.push(`${candidate.label}: ${getErrorMessage(error)}`);
      }
    }
  }

  const detail = parseFailures.at(0);
  throw new Error(detail ?? `${fileTypeName} statement is missing a recognizable transaction worksheet.`);
}

function readLegacyWorkbookRows(buffer: Buffer): WorkbookSheetRows[] {
  const workbook = legacyXlsx.read(buffer, { type: "buffer", cellDates: true });
  if (!workbook.SheetNames.length) {
    throw new Error("Excel statement is empty.");
  }
  if (workbook.SheetNames.length > maxExcelWorksheets) {
    throw new Error(`Excel statement has too many worksheets for automatic parsing. Limit is ${maxExcelWorksheets}.`);
  }

  return workbook.SheetNames.map((sheetName, sheetIndex) => ({
    sheetNumber: sheetIndex + 1,
    sheetName,
    rows: legacyWorksheetRowsToStatementRows(workbook.Sheets[sheetName], sheetName),
  }));
}

function legacyWorksheetRowsToStatementRows(
  sheet: legacyXlsx.WorkSheet | undefined,
  sheetName: string,
): StatementParserRow[] {
  if (!sheet?.["!ref"]) return [];

  const range = legacyXlsx.utils.decode_range(sheet["!ref"]);
  const rowCount = range.e.r - range.s.r + 1;
  const columnCount = range.e.c - range.s.c + 1;

  if (rowCount > maxExcelRowsPerSheet) {
    throw new Error(`Excel worksheet "${sheetName}" has too many rows for automatic parsing. Limit is ${maxExcelRowsPerSheet}.`);
  }
  if (columnCount > maxExcelColumnsPerSheet) {
    throw new Error(`Excel worksheet "${sheetName}" has too many columns for automatic parsing. Limit is ${maxExcelColumnsPerSheet}.`);
  }
  if (rowCount * Math.max(columnCount, 1) > maxExcelCellsPerSheet) {
    throw new Error(`Excel worksheet "${sheetName}" is too large for automatic parsing.`);
  }

  const rows: StatementParserRow[] = [];
  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const fields: string[] = [];
    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      const address = legacyXlsx.utils.encode_cell({ r: rowIndex, c: columnIndex });
      fields.push(legacyCellValueToText(sheet[address]?.v));
    }
    rows.push({ fields, sourceRowNumber: rowIndex + 1 });
  }
  return rows;
}

function layoutBStatementRows(sheet: WorkbookSheetRows): StatementParserRow[][] {
  const headerIndex = sheet.rows.findIndex((row) => {
    const headers = row.fields.map((field) => field.trim().toLowerCase().replace(/\s+/g, " "));
    return (
      headers.includes("date") &&
      headers.includes("value date") &&
      headers.some((header) => header.startsWith("transaction description")) &&
      headers.includes("debit") &&
      headers.includes("credit") &&
      headers.includes("running balance")
    );
  });
  if (headerIndex === -1) return [];

  const headerRow = sheet.rows[headerIndex];
  const transactionRows = sheet.rows.slice(headerIndex + 1);
  const transactionDates = transactionRows.map((row) => row.fields[0]?.trim()).filter((value): value is string => Boolean(value));
  const firstDate = transactionDates.at(0) ?? "";
  const lastDate = transactionDates.at(-1) ?? firstDate;
  const metadataRows = sheet.rows
    .slice(0, headerIndex)
    .map((row) => {
      const label = row.fields.map((field) => field.trim()).find((field) => /^(Opening|Ledger|Available) Balance$/i.test(field));
      const amount = firstAmountText(row.fields);
      if (!label || !amount) return null;
      const balanceDate = /^Opening Balance$/i.test(label) ? firstDate : lastDate;
      if (!balanceDate) return null;
      return {
        sourceRowNumber: row.sourceRowNumber,
        fields: [balanceDate, "", label, "", "", "", amount],
      } satisfies StatementParserRow;
    })
    .filter((row): row is StatementParserRow => row !== null);

  if (!metadataRows.length) return [];

  return [
    [
      {
        sourceRowNumber: headerRow.sourceRowNumber,
        fields: ["Date", "Value Date", "Transaction Description 1", "Transaction Description 2", "Debit", "Credit", "Running Balance"],
      },
      ...metadataRows,
      ...transactionRows,
    ],
  ];
}

function layoutCStatementRows(sheet: WorkbookSheetRows): StatementParserRow[][] {
  if (sheet.sheetName.trim().toLowerCase() !== "account_statement") return [];

  const dataRows = sheet.rows
    .filter((row) => row.sourceRowNumber >= 4)
    .map((row) => ({
      sourceRowNumber: row.sourceRowNumber,
      fields: [
        row.fields[2] ?? "",
        row.fields[3] ?? "",
        row.fields[5] ?? "",
        firstNonEmptyText(row.fields[8], row.fields[9], row.fields[10], row.fields[11]),
        row.fields[12] ?? "",
        row.fields[14] ?? "",
        row.fields[15] ?? "",
      ],
    }))
    .filter((row) => row.fields.some((field) => field.trim()));

  if (!dataRows.length) return [];

  return [
    [
      {
        sourceRowNumber: 3,
        fields: ["Date", "Value Date", "Description", "Reference", "Debit", "Credit", "Running Balance"],
      },
      ...dataRows,
    ],
  ];
}

function excelRawPayload(fileName: string | null | undefined, sheetNumber: number, sheetName: string, row: StatementParserRow) {
  return {
    fileName: fileName ?? null,
    sheetNumber,
    sheetName,
    sourceRowNumber: row.sourceRowNumber,
    fields: row.fields,
  };
}

function cellValueToText(value: Row[number]): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function legacyCellValueToText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function firstNonEmptyText(...values: Array<string | undefined>) {
  return values.map((value) => value?.trim() ?? "").find(Boolean) ?? "";
}

function firstAmountText(values: string[]) {
  for (const value of values) {
    const match = value.match(/\(?[+-]?(?:[$£€¥]|HKD|USD|SGD|AUD|CAD|NZD)?\s*\d[\d,\s]*(?:\.\d+)?\)?/i);
    if (match) return match[0].trim();
  }
  return undefined;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Unsupported worksheet shape.";
}
