import type { BankBalanceInput, BankTransactionInput } from "@/lib/server/bank-ledger";

export type ParsedStatementInput = {
  statementImportId: string;
  entityId: string;
  bankAccountId: string;
  defaultCurrency?: string | null;
  fileName?: string | null;
};

export type ParsedStatementResult = {
  transactions: BankTransactionInput[];
  balances: BankBalanceInput[];
  warnings: string[];
};

export type StatementParserRow = {
  fields: string[];
  sourceRowNumber: number;
};

type StatementRowsParserOptions = {
  fileTypeName?: string;
  sourceRecordPrefix?: string;
  sourceRowId?: (row: StatementParserRow) => string;
  balanceSourceRowId?: (row: StatementParserRow, balanceType: BankBalanceInput["balanceType"]) => string;
  rawPayload?: (row: StatementParserRow) => Record<string, unknown>;
  runningBalancePayload?: (row: StatementParserRow) => Record<string, unknown>;
  balancePayload?: (row: StatementParserRow) => Record<string, unknown>;
};

type ColumnMap = {
  date: number;
  postedDate?: number;
  description?: number;
  payee?: number;
  reference?: number;
  externalId?: number;
  amount?: number;
  debit?: number;
  credit?: number;
  currency?: number;
  balance?: number;
};

type DateFormat = "dmy" | "mdy";
type DateParseContext = {
  slashDateFormat: DateFormat | null;
  fallbackBalanceDate: string | null;
};

type ParsedTransactionRow = {
  transaction: BankTransactionInput;
  balance: BankBalanceInput | null;
};

type ParsedBalanceSnapshotRow = {
  balance: BankBalanceInput;
};

type RowParseOptions = Required<Pick<StatementRowsParserOptions, "fileTypeName" | "sourceRecordPrefix">> &
  Pick<StatementRowsParserOptions, "sourceRowId" | "rawPayload" | "runningBalancePayload">;

type BalanceParseOptions = Required<Pick<StatementRowsParserOptions, "fileTypeName" | "sourceRecordPrefix">> &
  Pick<StatementRowsParserOptions, "sourceRowId" | "balanceSourceRowId" | "rawPayload">;

const dateHeaders = ["date", "transaction date", "trans date", "posting date", "posted date", "value date", "effective date"];
const postedDateHeaders = ["posted date", "posting date", "value date"];
const descriptionHeaders = ["description", "details", "narrative", "memo", "transaction details", "particulars", "transaction description"];
const payeeHeaders = ["payee", "merchant", "counterparty", "beneficiary", "payer", "name"];
const referenceHeaders = ["reference", "ref", "transaction reference", "bank reference", "cheque number", "check number"];
const externalIdHeaders = ["fitid", "transaction id", "transaction identifier", "id", "unique id", "bank transaction id"];
const signedAmountHeaders = ["amount", "transaction amount", "signed amount", "net amount"];
const debitHeaders = ["debit", "withdrawal", "withdrawals", "payment", "payments", "money out", "outflow", "debit amount"];
const creditHeaders = ["credit", "deposit", "deposits", "receipt", "receipts", "money in", "inflow", "credit amount"];
const currencyHeaders = ["currency", "ccy", "currency code"];
const balanceHeaders = ["balance", "running balance", "available balance", "ledger balance", "opening balance", "closing balance", "current balance", "statement balance"];
const headerScanLimit = 25;

export function parseCsvStatement(csvText: string, input: ParsedStatementInput): ParsedStatementResult {
  const rows = parseCsv(csvText);
  return parseStatementRows(rows, input, {
    fileTypeName: "CSV",
    sourceRecordPrefix: "csv",
    balanceSourceRowId: (row, balanceType) => `${input.statementImportId}:balance:${balanceType}:row:${row.sourceRowNumber}`,
  });
}

export function parseStatementRows(
  rows: StatementParserRow[],
  input: ParsedStatementInput,
  options: StatementRowsParserOptions = {},
): ParsedStatementResult {
  const fileTypeName = options.fileTypeName ?? "Statement";
  const sourceRecordPrefix = options.sourceRecordPrefix ?? fileTypeName.toLowerCase();
  if (!rows.some((row) => row.fields.some((field) => field.trim()))) {
    throw new Error(`${fileTypeName} statement is empty.`);
  }

  const headerMatch = findHeaderRow(rows);
  if (!headerMatch) {
    throw new Error(`${fileTypeName} statement is missing a recognizable transaction header row.`);
  }

  const { columns, headerIndex } = headerMatch;
  const dataRows = rows.slice(headerIndex + 1);
  const dateContext = inferDateContext(dataRows, columns);
  const transactions: BankTransactionInput[] = [];
  const balances: BankBalanceInput[] = [];
  let skippedRows = 0;

  for (const row of dataRows) {
    if (isBlankRow(row.fields)) continue;

    const balanceSnapshot = parseBalanceSnapshotRow(row, columns, input, dateContext, {
      fileTypeName,
      sourceRecordPrefix,
      sourceRowId: options.sourceRowId,
      balanceSourceRowId: options.balanceSourceRowId,
      rawPayload: options.balancePayload,
    });
    if (balanceSnapshot) {
      balances.push(balanceSnapshot.balance);
      continue;
    }

    if (isIrrelevantSummaryRow(row.fields)) continue;

    const parsed = parseTransactionRow(row, columns, input, dateContext, {
      fileTypeName,
      sourceRecordPrefix,
      sourceRowId: options.sourceRowId,
      rawPayload: options.rawPayload,
      runningBalancePayload: options.runningBalancePayload,
    });
    if (!parsed) {
      skippedRows += 1;
      continue;
    }

    transactions.push(parsed.transaction);
    if (parsed.balance) balances.push(parsed.balance);
  }

  const warnings: string[] = [];
  if (skippedRows) {
    warnings.push(`Skipped ${skippedRows} row${skippedRows === 1 ? "" : "s"} with missing dates, amounts, or descriptions.`);
  }

  if (!transactions.length && !balances.length) {
    throw new Error(`${fileTypeName} statement did not contain valid transaction or balance rows.`);
  }

  return { transactions, balances, warnings };
}

function parseCsv(input: string): StatementParserRow[] {
  const rows: StatementParserRow[] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let rowNumber = 1;
  let currentRowNumber = 1;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (inQuotes) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      fields.push(field);
      rows.push({ fields, sourceRowNumber: currentRowNumber });
      fields = [];
      field = "";
      if (char === "\r" && next === "\n") index += 1;
      rowNumber += 1;
      currentRowNumber = rowNumber;
    } else {
      field += char;
    }
  }

  if (inQuotes) throw new Error("CSV statement has an unterminated quoted field.");
  if (field || fields.length) {
    fields.push(field);
    rows.push({ fields, sourceRowNumber: currentRowNumber });
  }

  return rows;
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function findHeaderRow(rows: StatementParserRow[]) {
  const scanLimit = Math.min(rows.length, headerScanLimit);
  for (let index = 0; index < scanLimit; index += 1) {
    const row = rows[index];
    if (!row.fields.some((field) => field.trim())) continue;

    const headers = row.fields.map(normalizeHeader);
    const columns = detectColumns(headers);
    if (columns) return { columns, headerIndex: index };
  }

  return null;
}

function detectColumns(headers: string[]): ColumnMap | null {
  const date = findHeader(headers, dateHeaders);
  const amount = findHeader(headers, signedAmountHeaders);
  const debit = findHeader(headers, debitHeaders);
  const credit = findHeader(headers, creditHeaders);
  const description = findHeader(headers, descriptionHeaders);
  const payee = findHeader(headers, payeeHeaders);
  const reference = findHeader(headers, referenceHeaders);

  if (date === undefined) return null;
  if (amount === undefined && debit === undefined && credit === undefined) return null;
  if (description === undefined && payee === undefined && reference === undefined) return null;

  return {
    date,
    postedDate: findHeader(headers, postedDateHeaders, date),
    description,
    payee,
    reference,
    externalId: findHeader(headers, externalIdHeaders),
    amount,
    debit,
    credit,
    currency: findHeader(headers, currencyHeaders),
    balance: findHeader(headers, balanceHeaders),
  };
}

function findHeader(headers: string[], candidates: string[], exclude?: number) {
  for (const candidate of candidates) {
    const index = headers.findIndex((header, headerIndex) => headerIndex !== exclude && header === candidate);
    if (index !== -1) return index;
  }

  for (const candidate of candidates) {
    const index = headers.findIndex((header, headerIndex) => headerIndex !== exclude && header.includes(candidate));
    if (index !== -1) return index;
  }

  return undefined;
}

function isBlankRow(fields: string[]) {
  const compact = fields.map((field) => field.trim()).filter(Boolean);
  return !compact.length;
}

function isIrrelevantSummaryRow(fields: string[]) {
  const compact = fields.map((field) => field.trim()).filter(Boolean);
  if (!compact.length) return true;
  const joined = compact.join(" ").toLowerCase();
  return /^(total|summary)\b/.test(joined);
}

function parseTransactionRow(
  row: StatementParserRow,
  columns: ColumnMap,
  input: ParsedStatementInput,
  dateContext: DateParseContext,
  options: RowParseOptions,
): ParsedTransactionRow | null {
  const transactionDate = parseDate(cell(row, columns.date), dateContext);
  const signedAmount = parseSignedAmount(row, columns);
  const description = firstNonEmpty(cell(row, columns.description), cell(row, columns.payee), cell(row, columns.reference));
  if (!transactionDate || signedAmount === undefined || !description) return null;

  const postedDate = columns.postedDate === undefined ? null : parseDate(cell(row, columns.postedDate), dateContext);
  const currency = normalizeCurrency(cell(row, columns.currency)) ?? normalizeCurrency(input.defaultCurrency) ?? "USD";
  const sourceRowId = options.sourceRowId?.(row) ?? `${input.statementImportId}:row:${row.sourceRowNumber}`;
  const reference = compact(cell(row, columns.reference));
  const payee = compact(cell(row, columns.payee));
  const explicitExternalId = compact(cell(row, columns.externalId));
  const balanceAmount = parseAmount(cell(row, columns.balance));

  const transaction: BankTransactionInput = {
    entityId: input.entityId,
    bankAccountId: input.bankAccountId,
    source: "manual",
    transactionDate,
    postedDate,
    description,
    payee,
    reference,
    amount: Math.abs(signedAmount),
    signedAmount,
    currency,
    externalId: explicitExternalId,
    sourceRowId,
    sourceRecordType: `${options.sourceRecordPrefix}_row`,
    statementImportId: input.statementImportId,
    rawPayload: options.rawPayload?.(row) ?? {
      fileName: input.fileName ?? null,
      sourceRowNumber: row.sourceRowNumber,
      fields: row.fields,
    },
  };

  const balance: BankBalanceInput | null =
    balanceAmount === undefined
      ? null
      : {
          entityId: input.entityId,
          bankAccountId: input.bankAccountId,
          source: "manual",
          balanceDate: postedDate ?? transactionDate,
          balanceType: "reported",
          amount: balanceAmount,
          currency,
          sourceRowId,
          sourceRecordType: `${options.sourceRecordPrefix}_running_balance`,
          statementImportId: input.statementImportId,
          rawPayload: options.runningBalancePayload?.(row) ?? {
            fileName: input.fileName ?? null,
            sourceRowNumber: row.sourceRowNumber,
          },
        };

  return { transaction, balance };
}

function parseBalanceSnapshotRow(
  row: StatementParserRow,
  columns: ColumnMap,
  input: ParsedStatementInput,
  dateContext: DateParseContext,
  options: BalanceParseOptions,
): ParsedBalanceSnapshotRow | null {
  const labelLayoutType = detectBalanceLabelValueLayoutType(row, columns);
  const isTransactionRow = parseTransactionRow(row, columns, input, dateContext, {
    fileTypeName: options.fileTypeName,
    sourceRecordPrefix: options.sourceRecordPrefix,
    sourceRowId: options.sourceRowId,
  }) !== null;
  const balanceType = labelLayoutType ?? (isTransactionRow ? null : detectBalanceSnapshotType(row.fields));
  if (!balanceType) return null;

  const amount =
    parseAmount(cell(row, columns.balance)) ??
    parseAmount(cell(row, columns.amount)) ??
    parseAmount(cell(row, columns.credit)) ??
    parseAmount(cell(row, columns.debit)) ??
    parseFirstAmount(row.fields);
  if (amount === undefined) return null;

  const balanceDate = parseDate(cell(row, columns.date), dateContext) ?? findFirstDate(row.fields, dateContext) ?? dateContext.fallbackBalanceDate;
  if (!balanceDate) return null;
  const currency = normalizeCurrency(cell(row, columns.currency)) ?? findCurrency(row.fields) ?? normalizeCurrency(input.defaultCurrency) ?? "USD";
  const rowId = options.sourceRowId?.(row) ?? `${input.statementImportId}:row:${row.sourceRowNumber}`;
  const sourceRowId = options.balanceSourceRowId?.(row, balanceType) ?? `${rowId}:balance:${balanceType}`;

  return {
    balance: {
      entityId: input.entityId,
      bankAccountId: input.bankAccountId,
      source: "manual",
      balanceDate,
      balanceType,
      amount,
      currency,
      sourceRowId,
      sourceRecordType: `${options.sourceRecordPrefix}_balance_snapshot`,
      statementImportId: input.statementImportId,
      rawPayload: options.rawPayload?.(row) ?? {
        fileName: input.fileName ?? null,
        sourceRowNumber: row.sourceRowNumber,
        fields: row.fields,
      },
    },
  };
}

function cell(row: StatementParserRow, index: number | undefined) {
  if (index === undefined) return "";
  return row.fields[index]?.trim() ?? "";
}

function firstNonEmpty(...values: string[]) {
  for (const value of values) {
    const compacted = compact(value);
    if (compacted) return compacted;
  }
  return null;
}

function compact(value: string | null | undefined) {
  const compacted = value?.trim().replace(/\s+/g, " ") ?? "";
  return compacted || null;
}

function normalizeCurrency(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase() ?? "";
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

function findCurrency(values: string[]) {
  for (const value of values) {
    const match = value.toUpperCase().match(/\b[A-Z]{3}\b/);
    if (match) {
      const currency = normalizeCurrency(match[0]);
      if (currency) return currency;
    }
  }

  return null;
}

function detectBalanceSnapshotType(fields: string[]): BankBalanceInput["balanceType"] | null {
  const joined = fields
    .map((field) => field.trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!/\bbalance\b/.test(joined)) return null;
  if (/\bopening\s+balance\b/.test(joined)) return "opening";
  if (/\bclosing\s+balance\b/.test(joined)) return "closing";
  if (/\bavailable\s+balance\b/.test(joined)) return "available";
  if (/\bcurrent\s+balance\b/.test(joined)) return "current";
  if (/\bstatement\s+balance\b/.test(joined)) return "statement";
  return null;
}

function detectBalanceLabelValueLayoutType(row: StatementParserRow, columns: ColumnMap): BankBalanceInput["balanceType"] | null {
  const labelCells = [cell(row, columns.description), cell(row, columns.payee), cell(row, columns.reference), ...row.fields];

  for (const value of labelCells) {
    const balanceType = detectBalanceLabelType(value);
    if (balanceType) return balanceType;
  }

  return null;
}

function detectBalanceLabelType(value: string): BankBalanceInput["balanceType"] | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*[:|-]\s*$/, "");

  if (normalized === "opening balance") return "opening";
  if (normalized === "closing balance") return "closing";
  if (normalized === "available balance") return "available";
  if (normalized === "current balance") return "current";
  if (normalized === "statement balance") return "statement";
  return null;
}

function parseFirstAmount(values: string[]) {
  for (const value of values) {
    const amount = parseAmount(value);
    if (amount !== undefined) return amount;

    const amountMatch = value.match(/\(?[+-]?(?:[$£€¥]|HKD|USD|SGD|AUD|CAD|NZD)?\s*\d[\d,\s]*(?:\.\d+)?\)?/i);
    if (!amountMatch) continue;

    const matchedAmount = parseAmount(amountMatch[0]);
    if (matchedAmount !== undefined) return matchedAmount;
  }

  return undefined;
}

function findFirstDate(values: string[], dateContext: DateParseContext) {
  for (const value of values) {
    const exact = parseDate(value, dateContext);
    if (exact) return exact;

    const dateMatch =
      value.match(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/) ??
      value.match(/\b\d{1,2}[-\s][A-Za-z]{3,9}[-,\s]\d{2,4}\b/) ??
      value.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/);
    if (!dateMatch) continue;

    const matchedDate = parseDate(dateMatch[0], dateContext);
    if (matchedDate) return matchedDate;
  }

  return null;
}

function inferDateContext(rows: StatementParserRow[], columns: ColumnMap): DateParseContext {
  let slashDateFormat: DateFormat | null = null;
  let hasAmbiguousSlashDate = false;

  for (const row of rows) {
    const values = [cell(row, columns.date), cell(row, columns.postedDate), ...row.fields];
    for (const value of values) {
      for (const match of slashDateParts(value)) {
        const evidence = slashDateEvidence(match.first, match.second);
        if (evidence) {
          if (slashDateFormat && slashDateFormat !== evidence) {
            throw new Error("CSV statement has conflicting slash date formats.");
          }
          slashDateFormat = evidence;
        } else {
          hasAmbiguousSlashDate = true;
        }
      }
    }
  }

  if (hasAmbiguousSlashDate && !slashDateFormat) {
    throw new Error("CSV statement has ambiguous slash dates. Use ISO YYYY-MM-DD dates or include a date that proves D/M/Y or M/D/Y.");
  }

  const parsedDates = rows
    .map((row) => parseDate(cell(row, columns.date), { slashDateFormat, fallbackBalanceDate: null }))
    .filter((date): date is string => Boolean(date))
    .sort();

  return {
    slashDateFormat,
    fallbackBalanceDate: parsedDates.at(-1) ?? null,
  };
}

function slashDateParts(value: string) {
  const matches: Array<{ first: number; second: number }> = [];
  const matcher = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/g;
  for (const match of value.matchAll(matcher)) {
    matches.push({ first: Number(match[1]), second: Number(match[2]) });
  }
  return matches;
}

function slashDateEvidence(first: number, second: number): DateFormat | null {
  if (first > 12 && second <= 12) return "dmy";
  if (second > 12 && first <= 12) return "mdy";
  return null;
}

function parseSignedAmount(row: StatementParserRow, columns: ColumnMap) {
  if (columns.amount !== undefined) {
    const amount = parseAmount(cell(row, columns.amount));
    if (amount !== undefined) return amount;
  }

  const debit = parseAmount(cell(row, columns.debit));
  const credit = parseAmount(cell(row, columns.credit));
  if (debit !== undefined && debit !== 0 && (credit === undefined || credit === 0)) return -Math.abs(debit);
  if (credit !== undefined && credit !== 0 && (debit === undefined || debit === 0)) return Math.abs(credit);
  if (debit !== undefined && credit !== undefined) return undefined;
  if (debit !== undefined) return -Math.abs(debit);
  if (credit !== undefined) return Math.abs(credit);
  return undefined;
}

function parseAmount(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /^[-–—]$/.test(trimmed)) return undefined;
  const isParenthesized = /^\(.*\)$/.test(trimmed);
  const normalized = trimmed
    .replace(/[()]/g, "")
    .replace(/[A-Z]{3}/gi, "")
    .replace(/[$£€¥HKDUSDSGDAUDCADNZD\s,]/g, "");
  if (!/^[+-]?\d*(?:\.\d+)?$/.test(normalized) || normalized === "" || normalized === "." || normalized === "+" || normalized === "-") {
    return undefined;
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return undefined;
  return isParenthesized ? -Math.abs(amount) : amount;
}

function parseDate(value: string, dateContext: DateParseContext = { slashDateFormat: null, fallbackBalanceDate: null }) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const iso = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return validIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const named = trimmed.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-,\s](\d{2,4})$/);
  if (named) {
    const month = monthNumber(named[2]);
    if (!month) return null;
    return validIsoDate(normalizeYear(Number(named[3])), month, Number(named[1]));
  }

  const slash = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!slash) return null;
  const first = Number(slash[1]);
  const second = Number(slash[2]);
  const year = normalizeYear(Number(slash[3]));
  const evidence = slashDateEvidence(first, second);
  const format = evidence ?? dateContext.slashDateFormat;
  if (!format) return null;
  return format === "dmy" ? validIsoDate(year, second, first) : validIsoDate(year, first, second);
}

function normalizeYear(year: number) {
  if (year < 100) return year >= 70 ? 1900 + year : 2000 + year;
  return year;
}

function monthNumber(value: string) {
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const index = months.indexOf(value.slice(0, 3).toLowerCase());
  return index === -1 ? null : index + 1;
}

function validIsoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}
