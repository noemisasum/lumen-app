import readXlsxFile, { type Row } from "read-excel-file/node";
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
const zipCentralDirectoryHeaderSignature = 0x02014b50;
const zipEndOfCentralDirectorySignature = 0x06054b50;
const zip64Sentinel = 0xffffffff;

type XlsxZipEntry = {
  name: string;
  uncompressedSize: number;
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

  const parseFailures: string[] = [];

  for (const [sheetIndex, sheet] of sheets.entries()) {
    const sheetNumber = sheetIndex + 1;
    const sheetName = sheet.sheet;
    const rows = sheet.data;
    const statementRows = worksheetRowsToStatementRows(rows, sheetName);
    if (!statementRows.length || !statementRows.some((row) => row.fields.some((field) => field.trim()))) continue;

    try {
      return parseStatementRows(statementRows, input, {
        fileTypeName: "Excel",
        sourceRecordPrefix: "excel",
        sourceRowId: (row) => `${input.statementImportId}:sheet:${sheetNumber}:row:${row.sourceRowNumber}`,
        balanceSourceRowId: (row, balanceType: BankBalanceInput["balanceType"]) =>
          `${input.statementImportId}:sheet:${sheetNumber}:balance:${balanceType}:row:${row.sourceRowNumber}`,
        rawPayload: (row) => excelRawPayload(input.fileName, sheetNumber, sheetName, row),
        runningBalancePayload: (row) => excelRawPayload(input.fileName, sheetNumber, sheetName, row),
        balancePayload: (row) => excelRawPayload(input.fileName, sheetNumber, sheetName, row),
      });
    } catch (error) {
      parseFailures.push(`${sheetName}: ${getErrorMessage(error)}`);
    }
  }

  const detail = parseFailures.at(0);
  throw new Error(detail ? `Excel statement could not be parsed automatically. ${detail}` : "Excel statement is missing a recognizable transaction worksheet.");
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

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Unsupported worksheet shape.";
}
