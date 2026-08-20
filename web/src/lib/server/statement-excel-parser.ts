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

export async function parseExcelStatement(excelData: ArrayBuffer, input: ParsedStatementInput): Promise<ParsedStatementResult> {
  const buffer = Buffer.from(excelData);
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
